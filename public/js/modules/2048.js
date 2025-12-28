export class Game2048 {
    constructor(gridId, size = 4) {
      this.size = size;
      this.grid = document.getElementById(gridId);
      this.board = [];
    }
  
    init() {
      this.board = Array(this.size)
        .fill()
        .map(() => Array(this.size).fill(0));
  
      this.addRandomTile();
      this.addRandomTile();
      this.render();
  
      this.bindEvents();
    }
  
    bindEvents() {
      document.addEventListener("keydown", (e) => {
        let moved = false;
  
        if (e.key === "ArrowLeft") moved = this.moveLeft();
        if (e.key === "ArrowRight") moved = this.moveRight();
        if (e.key === "ArrowUp") moved = this.moveUp();
        if (e.key === "ArrowDown") moved = this.moveDown();
  
        if (moved) {
          this.addRandomTile();
          this.render();
        }
      });
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
      this.board[r][c] = Math.random() < 0.9 ? 2 : 4;
    }
  
    render() {
        this.grid.innerHTML = "";
      
        for (let r = 0; r < this.size; r++) {
          for (let c = 0; c < this.size; c++) {
            const cell = document.createElement("div");
            cell.classList.add("cell");
      
            const value = this.board[r][c];
      
            if (value > 0) {
              cell.textContent = value;
              cell.setAttribute("data-value", value);
              cell.style.color = value <= 4 ? "#776e65" : "#f9f6f2";
            }
      
            this.grid.appendChild(cell);
          }
        }
      }      
  
    slide(row) {
      let arr = row.filter(v => v);
      for (let i = 0; i < arr.length - 1; i++) {
        if (arr[i] === arr[i + 1]) {
          arr[i] *= 2;
          arr[i + 1] = 0;
        }
      }
      arr = arr.filter(v => v);
      while (arr.length < this.size) arr.push(0);
      return arr;
    }
  
    moveLeft() {
      let moved = false;
      for (let r = 0; r < this.size; r++) {
        const newRow = this.slide(this.board[r]);
        if (newRow.toString() !== this.board[r].toString()) moved = true;
        this.board[r] = newRow;
      }
      return moved;
    }
  
    moveRight() {
      let moved = false;
      for (let r = 0; r < this.size; r++) {
        const reversed = this.slide([...this.board[r]].reverse()).reverse();
        if (reversed.toString() !== this.board[r].toString()) moved = true;
        this.board[r] = reversed;
      }
      return moved;
    }
  
    moveUp() {
      let moved = false;
      for (let c = 0; c < this.size; c++) {
        let col = this.board.map(row => row[c]);
        let newCol = this.slide(col);
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
        let newCol = this.slide(col).reverse();
        for (let r = 0; r < this.size; r++) {
          if (this.board[r][c] !== newCol[r]) moved = true;
          this.board[r][c] = newCol[r];
        }
      }
      return moved;
    }
  }
  