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
          setTimeout(() => {
            alert(`Game Over!\nĐiểm: ${this.score}\nNhấn R để chơi lại`);
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
          this.gameOver = true;
          setTimeout(() => {
            alert(`Game Over!\nĐiểm: ${this.score}\nNhấn R để chơi lại`);
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

    destroy() {
      if (this.handleKeyPress) {
        document.removeEventListener("keydown", this.handleKeyPress);
      }
    }
  }
  