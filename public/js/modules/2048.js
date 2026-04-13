import { rewards } from './rewards.js';
import { leaderboard } from './leaderboard.js';
import { supabase } from '../supabase/supabase.js';
import { getAuthUser } from '../supabase/auth.js';

// Constants
const GAME_CODE = '2048';
const MODE_CODE = 'classic';
const ARROW_KEYS = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown']);
const KEY_DIRECTION_MAP = {
  ArrowLeft:  'left',
  ArrowRight: 'right',
  ArrowUp:    'up',
  ArrowDown:  'down',
};
const ANIMATION_DURATION = 100;
const REWARD_NOTIFICATION_DURATION = 5000;

export class Game2048 {
  // ─── Constructor ────────────────────────────────────────────────────────────

  constructor(gridId, size = 4) {
    this.size = size;
    this.grid = document.getElementById(gridId);

    // Game state
    this.board        = [];
    this.score        = 0;
    this.moves        = 0;
    this.gameOver     = false;
    this.isAnimating  = false;
    this.newTilePos   = null;

    // Animation state — rebuilt on every render(), used only by animateMove()
    this.tileElements   = [];
    this.previousBoard  = [];

    // Touch state
    this.touchStart       = null;
    this.minSwipeDistance = 50;

    // UI refs
    this.ui = {
      score:               document.getElementById('score'),
      bestScore:           document.getElementById('best-score-display'),
      rank:                document.getElementById('rank-display'),
      leaderboardBtn:      document.getElementById('leaderboardBtn'),
      leaderboardDropdown: document.getElementById('leaderboardDropdown'),
      leaderboardList:     document.getElementById('leaderboard-list'),
      resetBtn:            document.getElementById('resetBtn'),
    };

    // Bound handler references (required for removeEventListener)
    this._onKeyDown      = this._handleKeyDown.bind(this);
    this._onTouchStart   = this._handleTouchStart.bind(this);
    this._onTouchMove    = this._handleTouchMove.bind(this);
    this._onTouchEnd     = this._handleTouchEnd.bind(this);
    this._onAuthChange   = this._handleAuthChange.bind(this);
    this._onClickOutside = this._handleClickOutside.bind(this);
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Initialize board state and attach events (call once). */
  init() {
    this._resetState();
    this._addRandomTile();
    this._addRandomTile();
    this._render();
    this._bindEvents();
    this._refreshDisplays();
  }

  /** Restart the game without re-binding events. */
  reset() {
    this._resetState();
    this._addRandomTile();
    this._addRandomTile();
    this._render();
    this._refreshDisplays();
  }

  /** Remove all event listeners — call when unmounting. */
  destroy() {
    document.removeEventListener('keydown',        this._onKeyDown);
    document.removeEventListener('click',          this._onClickOutside);
    window.removeEventListener('authStateChanged', this._onAuthChange);

    if (this.grid) {
      this.grid.removeEventListener('touchstart', this._onTouchStart);
      this.grid.removeEventListener('touchmove',  this._onTouchMove);
      this.grid.removeEventListener('touchend',   this._onTouchEnd);
    }
  }

  // ─── Initialization helpers ──────────────────────────────────────────────────

  _resetState() {
    const empty2D = () => Array.from({ length: this.size }, () => Array(this.size).fill(0));
    this.board         = empty2D();
    this.previousBoard = empty2D();
    this.score         = 0;
    this.moves         = 0;
    this.gameOver      = false;
    this.isAnimating   = false;
    this.newTilePos    = null;
    this.tileElements  = [];
  }

  /**
   * Bind all event listeners exactly once.
   * Removes existing listeners first to guard against duplicate registration.
   */
  _bindEvents() {
    this.destroy(); // clean slate

    document.addEventListener('keydown',        this._onKeyDown);
    document.addEventListener('click',          this._onClickOutside);
    window.addEventListener('authStateChanged', this._onAuthChange);

    if (this.grid) {
      this.grid.addEventListener('touchstart', this._onTouchStart, { passive: false });
      this.grid.addEventListener('touchmove',  this._onTouchMove,  { passive: false });
      this.grid.addEventListener('touchend',   this._onTouchEnd,   { passive: false });
    }

    this.ui.leaderboardBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleLeaderboard();
    });

    this.ui.resetBtn?.addEventListener('click', () => this.reset());
  }

  // ─── Event handlers ──────────────────────────────────────────────────────────

  _handleKeyDown(e) {
    if (this.gameOver || this.isAnimating) return;

    if (ARROW_KEYS.has(e.key)) e.preventDefault();

    const direction = KEY_DIRECTION_MAP[e.key];
    if (direction) { this._tryMove(direction); return; }
    if (e.key === 'r' || e.key === 'R') this.reset();
  }

  _handleTouchStart(e) {
    const t = e.touches[0];
    this.touchStart = { x: t.clientX, y: t.clientY };
  }

  _handleTouchMove(e) {
    e.preventDefault(); // block page scroll while swiping
  }

  _handleTouchEnd(e) {
    if (this.gameOver || this.isAnimating || !this.touchStart) return;

    const t  = e.changedTouches[0];
    const dx = t.clientX - this.touchStart.x;
    const dy = t.clientY - this.touchStart.y;
    this.touchStart = null;

    if (Math.max(Math.abs(dx), Math.abs(dy)) < this.minSwipeDistance) return;

    const direction = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? 'right' : 'left')
      : (dy > 0 ? 'down'  : 'up');

    this._tryMove(direction);
  }

  _handleAuthChange({ detail: { event, session } }) {
    if (event === 'SIGNED_IN' && session) {
      this._updateBestScoreDisplay();
      this._updateRankDisplay();
    } else if (event === 'SIGNED_OUT') {
      if (this.ui.bestScore) this.ui.bestScore.textContent = 'Best: --';
      if (this.ui.rank)      this.ui.rank.textContent      = 'Rank: --';
      if (this.ui.leaderboardDropdown) this.ui.leaderboardDropdown.style.display = 'none';
    }
  }

  _handleClickOutside(e) {
    const { leaderboardDropdown, leaderboardBtn } = this.ui;
    if (!leaderboardDropdown) return;
    if (!leaderboardDropdown.contains(e.target) && !leaderboardBtn?.contains(e.target)) {
      leaderboardDropdown.style.display = 'none';
    }
  }

  // ─── Core game logic ─────────────────────────────────────────────────────────

  /** Snapshot the board, execute a move, animate if tiles moved. */
  _tryMove(direction) {
    this.previousBoard = this.board.map(row => [...row]);

    const moved = this._executeMove(direction);
    if (!moved) return;

    this.moves++;
    this.isAnimating = true;
    this._animateMove(direction);
  }

  _executeMove(direction) {
    switch (direction) {
      case 'left':  return this._moveLeft();
      case 'right': return this._moveRight();
      case 'up':    return this._moveUp();
      case 'down':  return this._moveDown();
    }
  }

  /**
   * Slide and merge a single row leftward.
   * Returns { result, scoreGained } — does NOT mutate this.score.
   */
  _slide(row) {
    const arr = row.filter(Boolean);
    let scoreGained = 0;

    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i] === arr[i + 1]) {
        arr[i] *= 2;
        scoreGained += arr[i];
        arr.splice(i + 1, 1);
        i++; // skip already-merged tile
      }
    }

    while (arr.length < this.size) arr.push(0);
    return { result: arr, scoreGained };
  }

  _moveLeft() {
    let moved = false;
    for (let r = 0; r < this.size; r++) {
      const { result, scoreGained } = this._slide([...this.board[r]]);
      if (result.some((v, i) => v !== this.board[r][i])) {
        this.board[r] = result;
        this.score += scoreGained;
        moved = true;
      }
    }
    return moved;
  }

  _moveRight() {
    let moved = false;
    for (let r = 0; r < this.size; r++) {
      const { result, scoreGained } = this._slide([...this.board[r]].reverse());
      result.reverse();
      if (result.some((v, i) => v !== this.board[r][i])) {
        this.board[r] = result;
        this.score += scoreGained;
        moved = true;
      }
    }
    return moved;
  }

  _moveUp() {
    let moved = false;
    for (let c = 0; c < this.size; c++) {
      const { result, scoreGained } = this._slide(this.board.map(row => row[c]));
      if (result.some((v, r) => v !== this.board[r][c])) {
        result.forEach((v, r) => { this.board[r][c] = v; });
        this.score += scoreGained;
        moved = true;
      }
    }
    return moved;
  }

  _moveDown() {
    let moved = false;
    for (let c = 0; c < this.size; c++) {
      const { result, scoreGained } = this._slide(this.board.map(row => row[c]).reverse());
      result.reverse();
      if (result.some((v, r) => v !== this.board[r][c])) {
        result.forEach((v, r) => { this.board[r][c] = v; });
        this.score += scoreGained;
        moved = true;
      }
    }
    return moved;
  }

  _addRandomTile() {
    const empty = [];
    for (let r = 0; r < this.size; r++)
      for (let c = 0; c < this.size; c++)
        if (this.board[r][c] === 0) empty.push({ r, c });

    if (!empty.length) return;

    const { r, c }   = empty[Math.floor(Math.random() * empty.length)];
    this.board[r][c]  = Math.random() < 0.9 ? 2 : 4;
    this.newTilePos   = { r, c };
  }

  _isGameOver() {
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.board[r][c] === 0) return false;
        if (c < this.size - 1 && this.board[r][c] === this.board[r][c + 1]) return false;
        if (r < this.size - 1 && this.board[r][c] === this.board[r + 1][c]) return false;
      }
    }
    return true;
  }

  // ─── Animation ───────────────────────────────────────────────────────────────

  _animateMove(direction) {
    const isHorizontal = direction === 'left' || direction === 'right';
    const animations   = [];

    for (let i = 0; i < this.size; i++) {
      const list = isHorizontal
        ? this._buildRowAnimations(i, direction)
        : this._buildColAnimations(i, direction);
      animations.push(...list);
    }

    const finish = () => {
      this._addRandomTile();
      this._render();
      this.isAnimating = false;

      if (this._isGameOver()) {
        this.gameOver = true;
        setTimeout(() => this._handleGameOver(), 100);
      }
    };

    animations.length ? Promise.all(animations).then(finish) : finish();
  }

  /**
   * Build slide animations for a single row.
   * Uses a `consumed` bitmask to correctly handle duplicate tile values.
   */
  _buildRowAnimations(rowIdx, direction) {
    const cellSize = this._getCellSize();
    const oldRow   = this.previousBoard[rowIdx];
    const newRow   = this.board[rowIdx];
    const consumed = new Array(this.size).fill(false);
    const animations = [];

    const cols = direction === 'left'
      ? [...Array(this.size).keys()]
      : [...Array(this.size).keys()].reverse();

    for (const oldCol of cols) {
      const value = oldRow[oldCol];
      if (!value) continue;

      const newCol = this._findDest(newRow, value, direction === 'left', consumed);
      if (newCol === -1 || newCol === oldCol) continue;

      const el = this.tileElements[rowIdx]?.[oldCol];
      if (!el) continue;

      const anim = el.animate(
        [{ transform: 'translateX(0)' }, { transform: `translateX(${(newCol - oldCol) * cellSize}px)` }],
        { duration: ANIMATION_DURATION, easing: 'ease-out', fill: 'forwards' }
      );
      animations.push(anim.finished);
    }

    return animations;
  }

  /** Build slide animations for a single column. */
  _buildColAnimations(colIdx, direction) {
    const cellSize = this._getCellSize();
    const oldCol   = this.previousBoard.map(row => row[colIdx]);
    const newCol   = this.board.map(row => row[colIdx]);
    const consumed = new Array(this.size).fill(false);
    const animations = [];

    const rows = direction === 'up'
      ? [...Array(this.size).keys()]
      : [...Array(this.size).keys()].reverse();

    for (const oldRow of rows) {
      const value = oldCol[oldRow];
      if (!value) continue;

      const newRow = this._findDest(newCol, value, direction === 'up', consumed);
      if (newRow === -1 || newRow === oldRow) continue;

      const el = this.tileElements[oldRow]?.[colIdx];
      if (!el) continue;

      const anim = el.animate(
        [{ transform: 'translateY(0)' }, { transform: `translateY(${(newRow - oldRow) * cellSize}px)` }],
        { duration: ANIMATION_DURATION, easing: 'ease-out', fill: 'forwards' }
      );
      animations.push(anim.finished);
    }

    return animations;
  }

  /**
   * Find the first unconsumed index in `arr` that matches `value`,
   * searching from the front (fromStart=true) or back.
   */
  _findDest(arr, value, fromStart, consumed) {
    const indices = fromStart
      ? [...Array(arr.length).keys()]
      : [...Array(arr.length).keys()].reverse();

    for (const i of indices) {
      if (!consumed[i] && arr[i] === value) {
        consumed[i] = true;
        return i;
      }
    }
    return -1;
  }

  /** Read cell size from the DOM so it always matches the current CSS. */
  _getCellSize() {
    const firstCell = this.grid?.querySelector('.cell');
    if (firstCell) {
      const margin = parseInt(getComputedStyle(firstCell).marginRight || 0, 10);
      return firstCell.offsetWidth + margin;
    }
    return 95; // fallback
  }

  // ─── Rendering ───────────────────────────────────────────────────────────────

  _render() {
    this._updateScoreDisplay();

    this.tileElements = Array.from({ length: this.size }, () => Array(this.size).fill(null));
    const fragment    = document.createDocumentFragment();

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const value = this.board[r][c];
        const cell  = document.createElement('div');
        cell.classList.add('cell');

        if (value > 0) {
          cell.textContent  = value;
          cell.dataset.value = value;
          cell.classList.add(`tile-${value}`);
          cell.style.color  = value <= 4 ? '#776e65' : '#f9f6f2';

          if (this.newTilePos?.r === r && this.newTilePos?.c === c) {
            cell.classList.add('tile-new');
          }

          this.tileElements[r][c] = cell;
        } else {
          cell.classList.add('tile-empty');
        }

        fragment.appendChild(cell);
      }
    }

    this.grid.innerHTML = '';
    this.grid.appendChild(fragment);

    if (this.newTilePos) setTimeout(() => { this.newTilePos = null; }, 200);
  }

  // ─── Display updates ─────────────────────────────────────────────────────────

  _updateScoreDisplay() {
    if (this.ui.score) this.ui.score.textContent = `Điểm: ${this.score}`;
  }

  /** Fire both async display updates in parallel. */
  _refreshDisplays() {
    this._updateBestScoreDisplay();
    this._updateRankDisplay();
  }

  async _updateBestScoreDisplay() {
    if (!this.ui.bestScore) return;
    try {
      const authUser = await getAuthUser();
      if (!authUser?.id) { this.ui.bestScore.textContent = 'Best: --'; return; }

      const userBest = await leaderboard.getUserBestScore(authUser.id, GAME_CODE, MODE_CODE);
      this.ui.bestScore.textContent = userBest?.metric_value
        ? `Best: ${userBest.metric_value.toLocaleString()}`
        : 'Best: --';
    } catch {
      this.ui.bestScore.textContent = 'Best: --';
    }
  }

  async _updateRankDisplay() {
    if (!this.ui.rank) return;
    try {
      const authUser = await getAuthUser();
      if (!authUser?.id) { this.ui.rank.textContent = 'Rank: --'; return; }

      const userBest = await leaderboard.getUserBestScore(authUser.id, GAME_CODE, MODE_CODE);
      this.ui.rank.textContent = userBest?.user_rank
        ? `Rank: #${userBest.user_rank}`
        : 'Rank: --';
    } catch {
      this.ui.rank.textContent = 'Rank: --';
    }
  }

  // ─── Leaderboard ─────────────────────────────────────────────────────────────

  _toggleLeaderboard() {
    const { leaderboardDropdown } = this.ui;
    if (!leaderboardDropdown) return;

    const isVisible = leaderboardDropdown.style.display !== 'none';
    leaderboardDropdown.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) this._loadLeaderboard();
  }

  async _loadLeaderboard() {
    const { leaderboardList } = this.ui;
    if (!leaderboardList) return;

    try {
      const { leaderboard: data = [], currentUserId } =
        await leaderboard.getLeaderboardWithCurrentUser(GAME_CODE, MODE_CODE, 10);

      if (!data.length) {
        leaderboardList.innerHTML = '<div class="leaderboard-item">Chưa có dữ liệu</div>';
        return;
      }

      leaderboardList.innerHTML = data.map(item => {
        const rankClass = leaderboard.getRankDisplayClass(item.rank);
        const userClass = item.user_id === currentUserId ? 'current-user' : '';
        return `
          <div class="leaderboard-item ${rankClass} ${userClass}">
            <span class="leaderboard-rank ${rankClass}">${item.rank}</span>
            <span class="leaderboard-username">${item.username}</span>
            <span class="leaderboard-score">${leaderboard.formatMetricValue(item.metric_value, 'score')}</span>
          </div>
        `;
      }).join('');
    } catch {
      leaderboardList.innerHTML = '<div class="leaderboard-item">Lỗi tải dữ liệu</div>';
    }
  }

  // ─── Game over & rewards ──────────────────────────────────────────────────────

  async _handleGameOver() {
    try {
      const isLoggedIn = await rewards.isLoggedIn();
      if (!isLoggedIn) return;

      const submitResult = await supabase.functions.invoke('submitGameResult', {
        body: {
          game_code:    GAME_CODE,
          mode_code:    MODE_CODE,
          metric_type:  'score',
          metric_value: this.score,
          extra_data:   { moves: this.moves, gameOver: true },
        },
      });

      if (submitResult.error) {
        console.error('Failed to submit game result:', submitResult.error);
        return;
      }

      const sessionId = submitResult.data?.session_id;
      if (sessionId) {
        // Run reward calculation and leaderboard update concurrently
        const [rewardResult] = await Promise.allSettled([
          rewards.calculateRewardsForSession(sessionId),
          leaderboard.updateLeaderboard(sessionId),
        ]);

        if (rewardResult.status === 'fulfilled' && rewardResult.value) {
          const { xp_gained = 0, coins_gained = 0, gems_gained = 0 } = rewardResult.value;
          if (xp_gained > 0 || coins_gained > 0 || gems_gained > 0) {
            this._showRewardNotification(rewardResult.value);
          }
        }
      }

      // Refresh UI in parallel
      await Promise.allSettled([
        this._updateBestScoreDisplay(),
        this._updateRankDisplay(),
        this.ui.leaderboardDropdown?.style.display !== 'none'
          ? this._loadLeaderboard()
          : Promise.resolve(),
      ]);
    } catch (error) {
      console.error('Critical error in handleGameOver:', error);
      alert(`❌ Lỗi nghiêm trọng khi xử lý rewards: ${error.message}\n\nNhấn R để chơi lại`);
    }
  }

  _showRewardNotification({ xp_gained = 0, coins_gained = 0, gems_gained = 0, level_up = false }) {
    const items = [
      xp_gained    > 0 && `⭐ ${xp_gained} XP`,
      coins_gained > 0 && `🪙 ${coins_gained} Coins`,
      gems_gained  > 0 && `💎 ${gems_gained} Gems`,
      level_up         && `⬆️ LEVEL UP!`,
    ].filter(Boolean);

    if (!items.length) return;

    const notification = document.createElement('div');
    notification.className = 'reward-notification';
    notification.innerHTML = `
      <h3>🎉 Rewards Earned!</h3>
      <div class="reward-list">${items.join('<br>')}</div>
      <button class="reward-close-btn" onclick="this.parentElement.remove()">OK</button>
    `;

    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), REWARD_NOTIFICATION_DURATION);
  }
}