import { rewards } from './rewards.js';
import { supabase } from '../supabase/supabase.js';

export class Game2048 {
    constructor(gridId, size = 4) {
      this.size = size;
      this.grid = document.getElementById(gridId);
      this.board = [];
      this.score = 0;
      this.gameOver = false;
      this.cells = []; // Track DOM cells
      this.isAnimating = false;
      this.previousBoard = []; // Store previous board state for animation
      this.tileElements = []; // Store tile DOM elements

      // UI elements
      this.scoreDisplay = document.getElementById('score');
      this.bestScoreDisplay = document.getElementById('best-score-display');
      this.rankDisplay = document.getElementById('rank-display');
      this.leaderboardBtn = document.getElementById('leaderboardBtn');
      this.leaderboardDropdown = document.getElementById('leaderboardDropdown');
      this.leaderboardList = document.getElementById('leaderboard-list');

      // Game config cache
      this.gameConfig = null;

      // Touch event properties
      this.touchStartX = null;
      this.touchStartY = null;
      this.touchEndX = null;
      this.touchEndY = null;
      this.minSwipeDistance = 50; // Minimum distance for swipe detection
    }

    // Load game configuration
    async loadGameConfig() {
      if (this.gameConfig) return this.gameConfig;

      try {
        // Get game ID
        const { data: gameData, error: gameError } = await supabase
          .from('games')
          .select('id')
          .eq('code', '2048')
          .maybeSingle();

        if (gameError || !gameData) {
          console.error('Failed to load game config:', gameError);
          return null;
        }

        // Get mode ID
        const { data: modeData, error: modeError } = await supabase
          .from('game_modes')
          .select('id')
          .eq('game_id', gameData.id)
          .eq('code', 'classic')
          .maybeSingle();

        if (modeError || !modeData) {
          console.error('Failed to load game mode config:', modeError);
          return null;
        }

        this.gameConfig = {
          gameId: gameData.id,
          modeId: modeData.id
        };

        return this.gameConfig;
      } catch (error) {
        console.error('Error loading game config:', error);
        return null;
      }
    }

    init() {
      this.board = Array(this.size)
        .fill()
        .map(() => Array(this.size).fill(0));

      this.previousBoard = Array(this.size)
        .fill()
        .map(() => Array(this.size).fill(0));

      this.score = 0;
      this.gameOver = false;
      this.tileElements = [];

      this.addRandomTile();
      this.addRandomTile();
      this.render();

      // Update displays
      this.updateScoreDisplay();
      this.updateBestScoreDisplay();
      this.updateRankDisplay();

      this.bindEvents();
    }
  
    bindEvents() {
      this.handleKeyPress = (e) => {
        if (this.gameOver || this.isAnimating) return;

        // Prevent default behavior for arrow keys to avoid page scrolling
        if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
          e.preventDefault();
        }

        // Store previous board state
        this.previousBoard = this.board.map(row => [...row]);

        let moved = false;
        let direction = null;

        switch (e.key) {
          case "ArrowLeft":
            moved = this.moveLeft();
            direction = "left";
            break;
          case "ArrowRight":
            moved = this.moveRight();
            direction = "right";
            break;
          case "ArrowUp":
            moved = this.moveUp();
            direction = "up";
            break;
          case "ArrowDown":
            moved = this.moveDown();
            direction = "down";
            break;
          case "r":
          case "R":
            this.reset();
            return;
        }

        if (moved) {
          this.isAnimating = true;
          this.animateMove(direction);
        }
      };

      document.addEventListener("keydown", this.handleKeyPress);

      // Touch event listeners for mobile swipe support
      this.grid.addEventListener("touchstart", this.handleTouchStart.bind(this), { passive: false });
      this.grid.addEventListener("touchmove", this.handleTouchMove.bind(this), { passive: false });
      this.grid.addEventListener("touchend", this.handleTouchEnd.bind(this), { passive: false });

      // Leaderboard button
      if (this.leaderboardBtn) {
        this.leaderboardBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.toggleLeaderboard();
        });
      }

      // Close leaderboard when clicking outside
      document.addEventListener('click', (e) => {
        if (this.leaderboardDropdown &&
            !this.leaderboardDropdown.contains(e.target) &&
            !this.leaderboardBtn.contains(e.target)) {
          this.leaderboardDropdown.style.display = 'none';
        }
      });
    }

    // Touch event handlers for mobile swipe support
    handleTouchStart(e) {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
    }

    handleTouchMove(e) {
      // Prevent scrolling while swiping on the game grid
      e.preventDefault();
    }

    handleTouchEnd(e) {
      if (this.gameOver || this.isAnimating) return;

      this.touchEndX = e.changedTouches[0].clientX;
      this.touchEndY = e.changedTouches[0].clientY;

      this.handleSwipe();
    }

    handleSwipe() {
      if (!this.touchStartX || !this.touchStartY || !this.touchEndX || !this.touchEndY) return;

      const deltaX = this.touchEndX - this.touchStartX;
      const deltaY = this.touchEndY - this.touchStartY;
      const absDeltaX = Math.abs(deltaX);
      const absDeltaY = Math.abs(deltaY);

      // Check if swipe distance is sufficient
      if (Math.max(absDeltaX, absDeltaY) < this.minSwipeDistance) return;

      // Determine swipe direction
      let direction = null;

      if (absDeltaX > absDeltaY) {
        // Horizontal swipe
        direction = deltaX > 0 ? "right" : "left";
      } else {
        // Vertical swipe
        direction = deltaY > 0 ? "down" : "up";
      }

      // Store previous board state and trigger move
      this.previousBoard = this.board.map(row => [...row]);
      let moved = false;

      switch (direction) {
        case "left":
          moved = this.moveLeft();
          break;
        case "right":
          moved = this.moveRight();
          break;
        case "up":
          moved = this.moveUp();
          break;
        case "down":
          moved = this.moveDown();
          break;
      }

      if (moved) {
        this.isAnimating = true;
        this.animateMove(direction);
      }

      // Reset touch coordinates
      this.touchStartX = null;
      this.touchStartY = null;
      this.touchEndX = null;
      this.touchEndY = null;
    }

    reset() {
      this.score = 0;
      this.gameOver = false;
      this.init();
    }
  
    addRandomTile() {
      const empty = [];
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.board[r][c] === 0) empty.push({ r, c });
        }
      }
      if (!empty.length) return;

      const { r, c } = empty[Math.floor(Math.random() * empty.length)];
      const value = Math.random() < 0.9 ? 2 : 4;
      this.board[r][c] = value;
      this.score += value;

      // Mark this tile as new for animation
      this.newTilePosition = { r, c };
    }

    animateMove(direction) {
      const animations = [];

      // Animate row by row or column by column based on direction
      if (direction === 'left' || direction === 'right') {
        // Animate each row
        for (let r = 0; r < this.size; r++) {
          const rowAnimations = this.animateRow(r, direction);
          animations.push(...rowAnimations);
        }
      } else {
        // Animate each column
        for (let c = 0; c < this.size; c++) {
          const colAnimations = this.animateColumn(c, direction);
          animations.push(...colAnimations);
        }
      }

      // If no animations (no tiles moved), just proceed immediately
      if (animations.length === 0) {
        this.addRandomTile();
        this.render();
        this.isAnimating = false;

        if (this.isGameOver()) {
          this.gameOver = true;
          setTimeout(async () => {
            await this.handleGameOver();
          }, 100);
        }
        return;
      }

      // Wait for all animations to complete
      Promise.all(animations).then(() => {
        // Clean up sliding classes
        this.tileElements.forEach(row => {
          row.forEach(cell => {
            if (cell) cell.classList.remove('tile-sliding');
          });
        });

        // Add new tile and render
        this.addRandomTile();
        this.render();

        // Reset animation flag
        this.isAnimating = false;

        // Check game over
        if (this.isGameOver()) {
          console.log('🎯 GAME OVER DETECTED! Calling handleGameOver...');
          this.gameOver = true;
          setTimeout(async () => {
            console.log('⏰ Timeout triggered, calling handleGameOver now...');
            await this.handleGameOver();
          }, 100);
        }
      });
    }

    animateRow(rowIndex, direction) {
      const animations = [];
      const cellSize = 95;
      const oldRow = this.previousBoard[rowIndex];
      const newRow = this.board[rowIndex];

      // Find which tiles in this row actually moved
      for (let oldCol = 0; oldCol < this.size; oldCol++) {
        const value = oldRow[oldCol];
        if (value === 0) continue;

        // Find where this tile ended up in the new row
        const newCol = this.findValueInRow(newRow, value, oldCol, direction);
        if (newCol === -1 || newCol === oldCol) continue;

        const tileElement = this.tileElements[rowIndex][oldCol];
        if (!tileElement) continue;

        // Calculate movement distance
        const deltaX = (newCol - oldCol) * cellSize;

        if (deltaX !== 0) {
          tileElement.classList.add('tile-sliding');

          const animation = tileElement.animate([
            { transform: 'translateX(0)' },
            { transform: `translateX(${deltaX}px)` }
          ], {
            duration: 100,
            easing: 'ease-out',
            fill: 'forwards'
          });

          animations.push(animation.finished);
        }
      }

      return animations;
    }

    animateColumn(colIndex, direction) {
      const animations = [];
      const cellSize = 95;
      const oldCol = this.previousBoard.map(row => row[colIndex]);
      const newCol = this.board.map(row => row[colIndex]);

      // Find which tiles in this column actually moved
      for (let oldRow = 0; oldRow < this.size; oldRow++) {
        const value = oldCol[oldRow];
        if (value === 0) continue;

        // Find where this tile ended up in the new column
        const newRow = this.findValueInColumn(newCol, value, oldRow, direction);
        if (newRow === -1 || newRow === oldRow) continue;

        const tileElement = this.tileElements[oldRow][colIndex];
        if (!tileElement) continue;

        // Calculate movement distance
        const deltaY = (newRow - oldRow) * cellSize;

        if (deltaY !== 0) {
          tileElement.classList.add('tile-sliding');

          const animation = tileElement.animate([
            { transform: 'translateY(0)' },
            { transform: `translateY(${deltaY}px)` }
          ], {
            duration: 100,
            easing: 'ease-out',
            fill: 'forwards'
          });

          animations.push(animation.finished);
        }
      }

      return animations;
    }

    findValueInRow(row, value, startCol, direction) {
      // Search for the value in the row, preferring positions in the movement direction
      const step = direction === 'left' ? -1 : 1;
      const start = direction === 'left' ? startCol : startCol;
      const end = direction === 'left' ? -1 : this.size;

      for (let c = start; (step > 0 ? c < end : c > end); c += step) {
        if (row[c] === value) {
          return c;
        }
      }

      // If not found in preferred direction, search entire row
      for (let c = 0; c < this.size; c++) {
        if (row[c] === value) {
          return c;
        }
      }

      return -1;
    }

    findValueInColumn(col, value, startRow, direction) {
      // Search for the value in the column, preferring positions in the movement direction
      const step = direction === 'up' ? -1 : 1;
      const start = direction === 'up' ? startRow : startRow;
      const end = direction === 'up' ? -1 : this.size;

      for (let r = start; (step > 0 ? r < end : r > end); r += step) {
        if (col[r] === value) {
          return r;
        }
      }

      // If not found in preferred direction, search entire column
      for (let r = 0; r < this.size; r++) {
        if (col[r] === value) {
          return r;
        }
      }

      return -1;
    }
  
    render() {
        // Update score in header
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
          scoreElement.textContent = `Điểm: ${this.score}`;
        }

        // Clear grid
        this.grid.innerHTML = "";

        // Initialize tile elements array
        this.tileElements = Array(this.size).fill().map(() => Array(this.size).fill(null));

        for (let r = 0; r < this.size; r++) {
          for (let c = 0; c < this.size; c++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");

            const value = this.board[r][c];

            if (value > 0) {
              cell.textContent = value;
              cell.setAttribute("data-value", value);
              cell.style.color = value <= 4 ? "#776e65" : "#f9f6f2";

              // Thêm class cho styling dựa trên giá trị
              const className = `tile-${value}`;
              cell.classList.add(className);

              // Add animation class for new tiles
              if (this.newTilePosition && this.newTilePosition.r === r && this.newTilePosition.c === c) {
                cell.classList.add('tile-new');
              }

              // Store reference to tile element for animation
              this.tileElements[r][c] = cell;
            } else {
              cell.classList.add('tile-empty');
            }

            this.grid.appendChild(cell);
          }
        }

        // Clear new tile marker after animation
        if (this.newTilePosition) {
          setTimeout(() => {
            this.newTilePosition = null;
          }, 200);
        }
      }
  
    slide(row) {
      let arr = row.filter(v => v); // Lọc bỏ các ô trống
      const mergePositions = [];

      // Merge các ô giống nhau liên tiếp
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === arr[i + 1]) {
          const mergedValue = arr[i] * 2;
          arr[i] = mergedValue;  // Nhân đôi giá trị
          this.score += mergedValue; // Cộng điểm
          arr[i + 1] = 0;       // Đánh dấu ô thứ 2 đã được merge
          mergePositions.push(i); // Track merge position
          i++; // Skip ô tiếp theo vì đã merge
        }
      }

      arr = arr.filter(v => v); // Lọc lại để bỏ các ô đã merge
      while (arr.length < this.size) arr.push(0); // Thêm 0 để đủ kích thước
      return { result: arr, merges: mergePositions };
    }
  
    moveLeft() {
      let moved = false;
      for (let r = 0; r < this.size; r++) {
        const slideResult = this.slide(this.board[r]);
        const newRow = slideResult.result;
        if (newRow.toString() !== this.board[r].toString()) moved = true;
        this.board[r] = newRow;
      }
      return moved;
    }

    moveRight() {
      let moved = false;
      for (let r = 0; r < this.size; r++) {
        const slideResult = this.slide([...this.board[r]].reverse());
        const reversed = slideResult.result.reverse();
        if (reversed.toString() !== this.board[r].toString()) moved = true;
        this.board[r] = reversed;
      }
      return moved;
    }

    moveUp() {
      let moved = false;
      for (let c = 0; c < this.size; c++) {
        let col = this.board.map(row => row[c]);
        const slideResult = this.slide(col);
        let newCol = slideResult.result;
        for (let r = 0; r < this.size; r++) {
          if (this.board[r][c] !== newCol[r]) moved = true;
          this.board[r][c] = newCol[r];
        }
      }
      return moved;
    }

    moveDown() {
      let moved = false;
      for (let c = 0; c < this.size; c++) {
        let col = this.board.map(row => row[c]).reverse();
        const slideResult = this.slide(col);
        let newCol = slideResult.result.reverse();
        for (let r = 0; r < this.size; r++) {
          if (this.board[r][c] !== newCol[r]) moved = true;
          this.board[r][c] = newCol[r];
        }
      }
      return moved;
    }

    isGameOver() {
      // Kiểm tra còn ô trống không
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          if (this.board[r][c] === 0) return false;
        }
      }

      // Kiểm tra còn nước đi không (có thể merge không)
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          const value = this.board[r][c];

          // Kiểm tra ô bên phải
          if (c < this.size - 1 && value === this.board[r][c + 1]) return false;

          // Kiểm tra ô bên dưới
          if (r < this.size - 1 && value === this.board[r + 1][c]) return false;
        }
      }

      return true;
    }

    // Tính toán XP cho game 2048: (điểm số / 10000) + 15
    calculateXP() {
      return Math.floor(this.score / 10000) + 15;
    }

    // Tính toán coin dựa trên ô lớn nhất (từ 256 trở đi)
    // Công thức: 2^(n-1) coin với n bắt đầu từ 2 cho 256
    calculateCoins() {
      const maxTile = this.getMaxTile();

      // Chỉ tính coin từ 256 trở đi
      if (maxTile < 256) return 0;

      // Tính n: 256 = 2^8, n bắt đầu từ 2
      // n = (log2(maxTile) - 8) + 2 = log2(maxTile) - 6
      const n = Math.log2(maxTile) - 6;
      return Math.pow(2, n - 1);
    }

    // Tính toán gem dựa trên ô lớn nhất (từ 2048 trở đi)
    // Công thức: 2^(n-1) gem với n bắt đầu từ 2 cho 2048, công sai cấp số cộng là 4
    calculateGems() {
      const maxTile = this.getMaxTile();

      // Chỉ tính gem từ 2048 trở đi
      if (maxTile < 2048) return 0;

      // Tính n: 2048 = 2^11, n bắt đầu từ 2
      // Với công sai 4: n = 2 + 4 * (log2(maxTile) - 11)
      const exponent = Math.log2(maxTile);
      const n = 2 + 4 * (exponent - 11);
      return Math.pow(2, n - 1);
    }

    // Lấy giá trị ô lớn nhất trên bảng
    getMaxTile() {
      let max = 0;
      for (let r = 0; r < this.size; r++) {
        for (let c = 0; c < this.size; c++) {
          max = Math.max(max, this.board[r][c]);
        }
      }
      return max;
    }

    // Xử lý game over và grant rewards
    async handleGameOver() {
      console.log('🎮 === GAME OVER HANDLER STARTED ===');
      console.log('🎮 Game Over! Processing rewards...');
      console.log(`📊 Final Score: ${this.score}`);

      try {

      // Tính toán rewards
      const xp = this.calculateXP();
      const coins = this.calculateCoins();
      const gems = this.calculateGems();
      const maxTile = this.getMaxTile();

      console.log(`🎯 Calculated XP: ${xp} (from score ${this.score})`);
      console.log(`🪙 Calculated Coins: ${coins} (from max tile ${maxTile})`);
      console.log(`💎 Calculated Gems: ${gems} (from max tile ${maxTile})`);

      let message = `🎮 Game Over!\n`;
      message += `Điểm: ${this.score}\n`;
      message += `Ô lớn nhất: ${maxTile}\n\n`;

      // Hiển thị rewards
      if (xp > 0) message += `⭐ XP: ${xp}\n`;
      if (coins > 0) message += `🪙 Coins: ${coins}\n`;
      if (gems > 0) message += `💎 Gems: ${gems}\n`;

      // Submit game result qua Edge Function (tự động tính XP và update best score)
      const loginStatus = await rewards.isLoggedIn();

      if (loginStatus) {
        try {
          console.log('📤 Submitting 2048 game result...');
          const submitResponse = await fetch('/functions/v1/submitGameResult', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
            },
            body: JSON.stringify({
              game_code: '2048',
              mode_code: 'classic',
              metric_type: 'score',
              metric_value: this.score,
              extra_data: {
                maxTile: maxTile,
                moves: this.moves,
                gameOver: true
              }
            })
          });

          const submitResult = await submitResponse.json();

          if (submitResponse.ok) {
            console.log('✅ Game result submitted! Best score updated automatically.');
          } else {
            console.error('❌ Failed to submit game result:', submitResult);
          }
        } catch (error) {
          console.error('❌ Error submitting game result:', error);
        }

        console.log('✅ User is logged in, granting rewards...');
        try {
          // 🎯 Use new architecture: grantGameRewards with game result
          const gameResult = {
            maxTile: maxTile,
            score: this.score,
            moves: this.moves
          };

          const gameRewards = await rewards.grantGameRewards('2048', gameResult);

          if (gameRewards.success) {
            console.log('✅ 2048 rewards granted successfully:', gameRewards.rewards);
            message += `\n✅ Nhận được ${gameRewards.rewards.xp} XP và ${gameRewards.rewards.coins} coins!`;

            // Still grant gems separately (not handled by new architecture yet)
            if (gems > 0) {
              console.log(`💎 Granting ${gems} gems for 2048 game (max tile: ${maxTile})`);
              const gemsResult = await rewards.addGems(gems);
              if (gemsResult) {
                message += `\n💎 Nhận thêm ${gems} gems!`;
              }
            }
          } else {
            console.error('❌ Error granting 2048 rewards:', gameRewards.message);
            message += `\n❌ Lỗi khi lưu rewards: ${gameRewards.message}`;
          }
        } catch (error) {
          console.error('❌ Error granting 2048 rewards:', error);
          message += `\n❌ Lỗi khi lưu rewards: ${error.message}`;
        }
      } else {
        console.log('❌ User not logged in');
        message += `\n💡 Đăng nhập để lưu thành tích và nhận rewards!`;
      }

      message += `\n\nNhấn R để chơi lại`;

      console.log('🎮 === ALERT MESSAGE ===');
      console.log(message);
      console.log('🎮 === GAME OVER HANDLER ENDED ===');

      alert(message);

      } catch (error) {
        console.error('💥 CRITICAL ERROR in handleGameOver:', error);
        console.error('Stack trace:', error.stack);
        alert(`❌ Lỗi nghiêm trọng khi xử lý rewards: ${error.message}\n\nNhấn R để chơi lại`);
      }
    }

    // Update score display
    updateScoreDisplay() {
      if (this.scoreDisplay) {
        this.scoreDisplay.textContent = `Điểm: ${this.score}`;
      }
    }

    // Update best score display
    async updateBestScoreDisplay() {
      if (!this.bestScoreDisplay) return;

      try {
        const config = await this.loadGameConfig();
        if (!config) {
          this.bestScoreDisplay.textContent = 'Best: --';
          return;
        }

        const { data, error } = await supabase
          .from('game_best_scores')
          .select('metric_value')
          .eq('user_id', (await supabase.auth.getUser()).data.user?.id)
          .eq('game_id', config.gameId)
          .eq('mode_id', config.modeId)
          .maybeSingle();

        if (error || !data) {
          this.bestScoreDisplay.textContent = 'Best: --';
          return;
        }

        this.bestScoreDisplay.textContent = `Best: ${data.metric_value}`;
      } catch (error) {
        console.error('Error updating best score display:', error);
        this.bestScoreDisplay.textContent = 'Best: --';
      }
    }

    // Update rank display
    async updateRankDisplay() {
      if (!this.rankDisplay) return;

      try {
        const { data, error } = await supabase
          .from('v_user_best_scores')
          .select('user_rank')
          .eq('game_code', '2048')
          .eq('mode_code', 'classic')
          .maybeSingle();

        if (error || !data) {
          this.rankDisplay.textContent = 'Rank: --';
          return;
        }

        this.rankDisplay.textContent = `Rank: #${data.user_rank || '--'}`;
      } catch (error) {
        console.error('Error updating rank display:', error);
        this.rankDisplay.textContent = 'Rank: --';
      }
    }

    // Toggle leaderboard dropdown
    toggleLeaderboard() {
      if (!this.leaderboardDropdown) return;

      const isVisible = this.leaderboardDropdown.style.display !== 'none';

      if (isVisible) {
        this.leaderboardDropdown.style.display = 'none';
      } else {
        this.leaderboardDropdown.style.display = 'block';
        this.loadLeaderboard();
      }
    }

    // Load leaderboard data
    async loadLeaderboard() {
      if (!this.leaderboardList) return;

      try {
        const { data, error } = await supabase
          .rpc('get_leaderboard', {
            p_game_code: '2048',
            p_mode_code: 'classic',
            p_limit: 10
          });

        if (error) {
          console.error('Error loading leaderboard:', error);
          this.leaderboardList.innerHTML = '<div class="leaderboard-item">Không thể tải leaderboard</div>';
          return;
        }

        const user = await supabase.auth.getUser();
        const currentUserId = user.data.user?.id;

        this.leaderboardList.innerHTML = data.map(item => `
          <div class="leaderboard-item ${item.user_id === currentUserId ? 'current-user' : ''}">
            <span class="leaderboard-rank">${item.rank}</span>
            <span class="leaderboard-username">${item.username}</span>
            <span class="leaderboard-score">${item.metric_value.toLocaleString()}</span>
          </div>
        `).join('');

      } catch (error) {
        console.error('Error in loadLeaderboard:', error);
        this.leaderboardList.innerHTML = '<div class="leaderboard-item">Lỗi tải dữ liệu</div>';
      }
    }

    destroy() {
      if (this.handleKeyPress) {
        document.removeEventListener("keydown", this.handleKeyPress);
      }

      // Remove touch event listeners
      if (this.grid) {
        this.grid.removeEventListener("touchstart", this.handleTouchStart);
        this.grid.removeEventListener("touchmove", this.handleTouchMove);
        this.grid.removeEventListener("touchend", this.handleTouchEnd);
      }
    }
  }
  