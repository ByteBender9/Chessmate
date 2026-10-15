import { Chess } from 'https://cdn.jsdelivr.net/npm/chess.js@1.4.0/+esm';

const $ = (id) => document.getElementById(id);
const PIECES = { wk:'♔', wq:'♕', wr:'♖', wb:'♗', wn:'♘', wp:'♙', bk:'♚', bq:'♛', br:'♜', bb:'♝', bn:'♞', bp:'♟' };
const VALUES = { p:100, n:320, b:335, r:500, q:900, k:20000 };
let game = new Chess();
let selected = null;
let legalMoves = [];
let orientation = 'w';
let playerColor = 'w';
let mode = 'ai';
let difficulty = 'medium';
let thinking = false;
let gameStarted = false;
let pendingPromotion = null;
let timerSeconds = 600;
let clocks = { w:600, b:600 };
let timerEnabled = true;
let timerInterval = null;
let lastTick = Date.now();
let soundEnabled = false;
let toastTimeout;

function notify(message) {
  const toast = $('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2400);
}
function sound(type='move') {
  if (!soundEnabled) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const ctx = new Ctx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.connect(gain); gain.connect(ctx.destination);
    oscillator.frequency.value = type === 'capture' ? 210 : type === 'check' ? 650 : 390;
    gain.gain.setValueAtTime(0.07, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);
    oscillator.start(); oscillator.stop(ctx.currentTime + 0.1);
    oscillator.onended = () => ctx.close();
  } catch (_) { /* Sound is an optional enhancement. */ }
}
function getPlayerName(color) {
  if (mode === 'local') return color === 'w' ? 'White player' : 'Black player';
  return color === playerColor ? 'You' : 'Chessmate';
}
function displayColor(color) { return color === 'w' ? 'White' : 'Black'; }
function isHumanTurn() { return mode === 'local' || game.turn() === playerColor; }
function coord(r,c) { return String.fromCharCode(97+c) + (8-r); }
function updatePlayerCards() {
  const topColor = orientation === 'w' ? 'b' : 'w';
  const bottomColor = orientation === 'w' ? 'w' : 'b';
  $('top-name').textContent = getPlayerName(topColor);
  $('top-caption').textContent = mode === 'local' ? `${displayColor(topColor)} pieces` : topColor === playerColor ? 'Your pieces' : `Computer opponent · ${displayColor(topColor)}`;
  $('top-rating').textContent = mode === 'local' ? 'LOCAL' : topColor === playerColor ? 'YOU' : 'AI';
  $('bottom-name').textContent = getPlayerName(bottomColor);
  $('bottom-caption').textContent = mode === 'local' ? `${displayColor(bottomColor)} pieces` : bottomColor === playerColor ? `Your pieces · ${displayColor(bottomColor)}` : `Computer opponent · ${displayColor(bottomColor)}`;
  $('top-player').querySelector('.player-avatar').textContent = topColor === 'w' ? '♔' : '♚';
  $('top-player').querySelector('.player-avatar').className = `player-avatar ${topColor === 'w' ? 'light-avatar' : 'dark-avatar'}`;
  $('bottom-player').querySelector('.player-avatar').textContent = bottomColor === 'w' ? '♔' : '♚';
  $('bottom-player').querySelector('.player-avatar').className = `player-avatar ${bottomColor === 'w' ? 'light-avatar' : 'dark-avatar'}`;
}
function renderBoard() {
  const boardEl = $('chessboard');
  boardEl.innerHTML = '';
  const board = game.board();
  const last = game.history({ verbose:true }).at(-1);
  const king = game.isCheck() ? findKingSquare(game.turn()) : null;
  for (let displayR=0; displayR<8; displayR++) {
    for (let displayC=0; displayC<8; displayC++) {
      const r = orientation === 'w' ? displayR : 7-displayR;
      const c = orientation === 'w' ? displayC : 7-displayC;
      const squareName = coord(r,c);
      const piece = board[r][c];
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `square ${(r+c)%2===0?'light':'dark'}`;
      button.dataset.square = squareName;
      button.setAttribute('role','gridcell');
      button.setAttribute('aria-label', `${squareName}${piece ? ` ${piece.color==='w'?'white':'black'} ${piece.type}` : ' empty'}`);
      if (selected === squareName) button.classList.add('selected');
      if (last && (last.from === squareName || last.to === squareName)) button.classList.add('last-move');
      if (king === squareName) button.classList.add('in-check');
      const targetMove = legalMoves.find(m => m.to === squareName);
      if (targetMove) button.classList.add(piece ? 'legal-capture' : 'legal-target');
      if (piece) {
        const span = document.createElement('span');
        span.className = `piece ${piece.color==='w'?'white':'black'}`;
        span.textContent = PIECES[piece.color+piece.type];
        button.append(span);
      }
      if (displayC === 0) {
        const rank = document.createElement('span'); rank.className='coord rank'; rank.textContent=String(8-r); button.append(rank);
      }
      if (displayR === 7) {
        const file = document.createElement('span'); file.className='coord file'; file.textContent=String.fromCharCode(97+c); button.append(file);
      }
      button.addEventListener('click', () => onSquareClick(squareName));
      boardEl.append(button);
    }
  }
  updatePlayerCards();
  renderStatus();
  renderHistory();
  renderCaptured();
  renderClocks();
}
function findKingSquare(color) {
  const board = game.board();
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) if (board[r][c]?.type==='k' && board[r][c].color===color) return coord(r,c);
  return null;
}
function renderStatus() {
  const status = $('game-status'); const detail = $('status-detail');
  $('status-indicator').style.background = game.isGameOver() ? '#e37e71' : game.isCheck() ? '#e9a05b' : 'var(--green)';
  $('turn-progress-fill').style.width = game.turn()==='w' ? '50%' : '100%';
  if (game.isCheckmate()) {
    status.textContent = `${displayColor(game.turn()==='w'?'b':'w')} wins!`;
    detail.textContent = `Checkmate. ${displayColor(game.turn())} has no legal move.`;
  } else if (game.isStalemate()) { status.textContent='Draw by stalemate'; detail.textContent='No legal moves remain, but the king is not in check.'; }
  else if (game.isThreefoldRepetition()) { status.textContent='Draw by repetition'; detail.textContent='The same position occurred three times.'; }
  else if (game.isInsufficientMaterial()) { status.textContent='Draw · insufficient material'; detail.textContent='Neither side has enough material to checkmate.'; }
  else if (game.isDraw()) { status.textContent='Game drawn'; detail.textContent='The game ended in a draw.'; }
  else if (thinking) { status.textContent='AI is thinking…'; detail.textContent='Calculating a good move for the position.'; }
  else if (game.isCheck()) { status.textContent=`${displayColor(game.turn())} is in check`; detail.textContent=isHumanTurn()?'Find a safe move for your king.':'The king is under attack.'; }
  else { status.textContent=`${displayColor(game.turn())} to move`; detail.textContent=gameStarted ? (mode==='ai' && !isHumanTurn() ? 'The computer is preparing its move.' : 'Choose a piece to see its legal moves.') : 'Choose your settings, then start a new game.'; }
}
function renderHistory() {
  const list = $('move-list'); list.innerHTML='';
  const moves = game.history({verbose:true});
  if (!moves.length) {
    const empty=document.createElement('div');empty.className='empty-history';empty.innerHTML='<span>♟</span><p>Your moves will appear here.</p>';list.append(empty);
  } else {
    for(let i=0;i<moves.length;i+=2) {
      const row=document.createElement('div');row.className='move-row';if(i+2>=moves.length)row.classList.add('latest');
      const number=document.createElement('span');number.className='move-number';number.textContent=`${Math.floor(i/2)+1}.`;
      const white=document.createElement('span');white.className='move-san';white.textContent=moves[i].san;
      const black=document.createElement('span');black.className='move-san';black.textContent=moves[i+1]?.san||'';
      row.append(number,white,black);list.append(row);
    }
    list.scrollTop=list.scrollHeight;
  }
  $('move-count').textContent=`${moves.length} ${moves.length===1?'move':'moves'} played`;
}
function renderCaptured() {
  const history=game.history({verbose:true});const captured={w:[],b:[]};
  for(const move of history) if(move.captured) captured[move.color].push((move.color==='w'?'b':'w')+move.captured);
  for(const color of ['w','b']) {
    const el=$(`captured-${color==='w'?'white':'black'}`);el.textContent=captured[color].length?captured[color].map(p=>PIECES[p]).join(' '):'—';
  }
}
function renderClocks() {
  const fmt = n => `${Math.floor(Math.max(0,n)/60).toString().padStart(2,'0')}:${Math.floor(Math.max(0,n)%60).toString().padStart(2,'0')}`;
  const topColor=orientation==='w'?'b':'w',bottomColor=orientation==='w'?'w':'b';
  $('bottom-clock').textContent=timerEnabled?fmt(clocks[bottomColor]):'∞';
  $('bottom-clock').classList.toggle('active',timerEnabled&&gameStarted&&!game.isGameOver()&&!thinking&&game.turn()===bottomColor);
  let topClock=document.getElementById('top-clock');
  if(!topClock){topClock=document.createElement('div');topClock.id='top-clock';topClock.className='clock';$('top-player').append(topClock)}
  topClock.textContent=timerEnabled?fmt(clocks[topColor]):'∞';
  topClock.classList.toggle('active',timerEnabled&&gameStarted&&!game.isGameOver()&&!thinking&&game.turn()===topColor);
  $('top-rating').style.display=timerEnabled?'none':'';
}
function onSquareClick(square) {
  if (!gameStarted || game.isGameOver() || thinking || !isHumanTurn()) return;
  const piece=game.get(square);
  if (selected) {
    const move=legalMoves.find(m=>m.to===square);
    if(move) {
      if(move.flags.includes('p')) { pendingPromotion={from:selected,to:square};$('promotion-dialog').hidden=false;return; }
      makeMove(selected,square);return;
    }
    if(piece && piece.color===game.turn()) { selectSquare(square);return; }
    selected=null;legalMoves=[];renderBoard();return;
  }
  if(piece && piece.color===game.turn()) selectSquare(square);
}
function selectSquare(square) {
  selected=square;legalMoves=game.moves({square,verbose:true});renderBoard();
}
function makeMove(from,to,promotion='q') {
  try {
    const move=game.move({from,to,promotion});
    if(!move)return;
    selected=null;legalMoves=[];sound(move.captured?'capture':game.isCheck()?'check':'move');
    renderBoard();
    if(game.isGameOver()) { stopTimer(); if(game.isCheckmate()) notify(`${displayColor(game.turn()==='w'?'b':'w')} wins by checkmate!`); else notify('Game over — draw.');return; }
    if(timerEnabled) lastTick=Date.now();
    if(mode==='ai' && game.turn()!==playerColor) scheduleAiMove();
  } catch(error) { console.error(error); notify('That move could not be played.'); }
}
function startGame() {
  stopTimer();game=new Chess();selected=null;legalMoves=[];pendingPromotion=null;thinking=false;gameStarted=true;
  mode=$('game-mode').value;difficulty=$('difficulty').value;playerColor=$('player-color').value;orientation=playerColor;
  timerSeconds=Number($('time-control').value);timerEnabled=timerSeconds>0;clocks={w:timerSeconds,b:timerSeconds};
  $('promotion-dialog').hidden=true;
  renderBoard();startTimer();
  if(mode==='ai' && playerColor==='b') scheduleAiMove(250);
}
function startTimer() {
  stopTimer();if(!timerEnabled)return;lastTick=Date.now();
  timerInterval=setInterval(()=>{
    if(!gameStarted||game.isGameOver()||thinking)return;
    const now=Date.now();const elapsed=(now-lastTick)/1000;lastTick=now;
    clocks[game.turn()]-=elapsed;
    if(clocks[game.turn()]<=0){clocks[game.turn()]=0;stopTimer();gameStarted=false;renderClocks();$('game-status').textContent=`${displayColor(game.turn()==='w'?'b':'w')} wins on time`; $('status-detail').textContent='The other player ran out of time.';notify('Time is up!');return;}
    renderClocks();
  },250);
}
function stopTimer(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;}}
function scheduleAiMove(delay=120) {
  if(!gameStarted||game.isGameOver())return;
  thinking=true;selected=null;legalMoves=[];renderBoard();
  setTimeout(()=>{
    if(!gameStarted||game.isGameOver()||game.turn()===playerColor)return;
    const move=chooseAiMove(game,difficulty);
    thinking=false;
    if(move)makeMove(move.from,move.to,move.promotion||'q');else renderBoard();
  },delay);
}
function evaluate(position, aiColor) {
  if(position.isCheckmate())return position.turn()===aiColor?-100000:100000;
  if(position.isDraw())return 0;
  const board=position.board();let score=0;
  for(let r=0;r<8;r++)for(let c=0;c<8;c++){
    const p=board[r][c];if(!p)continue;
    const sign=p.color===aiColor?1:-1;const value=VALUES[p.type];
    const center=3.5-(Math.abs(3.5-r)+Math.abs(3.5-c))/2;
    let positional=0;
    if(p.type==='n'||p.type==='b')positional=center*8;
    if(p.type==='p')positional+=(p.color==='w'?(6-r):(r-1))*4 + center*2;
    if(p.type==='k' && position.history().length<24)positional-=center*5;
    score+=sign*(value+positional);
  }
  const mobility=position.moves().length;
  return score+(position.turn()===aiColor?1:-1)*mobility*1.5;
}
function orderMoves(moves) {
  const v={p:100,n:320,b:335,r:500,q:900,k:20000};
  return moves.sort((a,b)=>((b.captured?v[b.captured]||0:0)*10+(b.promotion?v[b.promotion]||0:0))-((a.captured?v[a.captured]||0:0)*10+(a.promotion?v[a.promotion]||0:0)));
}
function minimax(position, depth, alpha, beta, maximizing, aiColor) {
  if(depth===0||position.isGameOver())return evaluate(position,aiColor);
  const moves=orderMoves(position.moves({verbose:true}));
  if(maximizing){let best=-Infinity;for(const move of moves){position.move(move);best=Math.max(best,minimax(position,depth-1,alpha,beta,false,aiColor));position.undo();alpha=Math.max(alpha,best);if(beta<=alpha)break;}return best;}
  let best=Infinity;for(const move of moves){position.move(move);best=Math.min(best,minimax(position,depth-1,alpha,beta,true,aiColor));position.undo();beta=Math.min(beta,best);if(beta<=alpha)break;}return best;
}
function chooseAiMove(position,level) {
  const legal=orderMoves(position.moves({verbose:true}));if(!legal.length)return null;
  if(level==='easy') {
    const captures=legal.filter(m=>m.captured);const pool=Math.random()<.45&&captures.length?captures:legal;
    return pool[Math.floor(Math.random()*pool.length)];
  }
  const depth=level==='hard'?3:2;const aiColor=position.turn();let best=-Infinity,bestMoves=[];
  for(const move of legal){position.move(move);const score=minimax(position,depth-1,-Infinity,Infinity,false,aiColor);position.undo();if(score>best){best=score;bestMoves=[move];}else if(score===best)bestMoves.push(move);}
  return bestMoves[Math.floor(Math.random()*bestMoves.length)]||legal[0];
}
function undoMove() {
  if(thinking){notify('Wait for the computer to finish its move.');return;}
  if(!game.history().length){notify('There are no moves to undo yet.');return;}
  game.undo();
  if(mode==='ai'&&game.history().length&&game.turn()!==playerColor)game.undo();
  selected=null;legalMoves=[];gameStarted=true;renderBoard();if(timerEnabled)lastTick=Date.now();if(mode==='ai'&&game.turn()!==playerColor)scheduleAiMove(250);
}
function exportPgn() {
  if(!game.history().length){notify('Play a move before exporting a game.');return;}
  const blob=new Blob([game.pgn({maxWidth:80,maxColumn:0})+'\n'],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='chessmate-game.pgn';document.body.append(a);a.click();a.remove();URL.revokeObjectURL(url);notify('PGN game exported.');
}
async function copyPgn(){if(!game.history().length){notify('No moves to copy yet.');return;}try{await navigator.clipboard.writeText(game.pgn());notify('Game notation copied.');}catch(_){notify('Use Export game to save your PGN file.');}}
$('start-game').addEventListener('click',startGame);
$('new-game-inline').addEventListener('click',startGame);
$('flip-board').addEventListener('click',()=>{orientation=orientation==='w'?'b':'w';renderBoard();});
$('undo-move').addEventListener('click',undoMove);
$('download-pgn').addEventListener('click',exportPgn);
$('copy-pgn').addEventListener('click',copyPgn);
$('game-mode').addEventListener('change',()=>{$('ai-settings').hidden=$('game-mode').value==='local';});
$('sound-toggle').addEventListener('click',()=>{soundEnabled=!soundEnabled;$('sound-toggle').classList.toggle('sound-on',soundEnabled);$('sound-toggle').setAttribute('aria-label',soundEnabled?'Mute sound':'Enable sound');notify(soundEnabled?'Move sounds enabled.':'Move sounds muted.');if(soundEnabled)sound();});
$('promotion-dialog').querySelectorAll('[data-piece]').forEach(button=>button.addEventListener('click',()=>{if(!pendingPromotion)return;const p=button.dataset.piece;const move=pendingPromotion;pendingPromotion=null;$('promotion-dialog').hidden=true;makeMove(move.from,move.to,p);}));
$('promotion-dialog').addEventListener('click',event=>{if(event.target===$('promotion-dialog')){$('promotion-dialog').hidden=true;pendingPromotion=null;}});
$('time-control').addEventListener('change',()=>{if(game.history().length===0)startGame();});
$('difficulty').addEventListener('change',()=>{if(game.history().length===0&&mode==='ai')difficulty=$('difficulty').value;});
$('player-color').addEventListener('change',()=>{if(game.history().length===0&&mode==='ai')startGame();});
window.addEventListener('beforeunload',stopTimer);
$('ai-settings').hidden=false;
// Render a ready-to-play board immediately; press Start new game to apply custom settings.
renderBoard();

// ==========================================
// CHESSMATE — BOARD THEME CUSTOMIZATION
// ==========================================

const BOARD_THEMES = ["purple", "classic", "blue", "wood"];

function applyBoardTheme(theme) {
  const selectedTheme = BOARD_THEMES.includes(theme)
    ? theme
    : "purple";

  // Apply the selected board theme
  document.body.dataset.boardTheme = selectedTheme;

  // Update the active theme button
  document
    .querySelectorAll("#board-theme-picker [data-board-theme]")
    .forEach((button) => {
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.boardTheme === selectedTheme)
      );
    });

  // Save the selected theme in the browser
  try {
    localStorage.setItem("chessmate-board-theme", selectedTheme);
  } catch (error) {
    console.warn("Could not save the board theme.", error);
  }
}

function initBoardThemes() {
  const picker = document.getElementById("board-theme-picker");

  // Do nothing if the theme selector isn't in the HTML
  if (!picker) return;

  // Handle theme selection
  picker.addEventListener("click", (event) => {
    const button = event.target.closest("[data-board-theme]");

    if (!button) return;

    applyBoardTheme(button.dataset.boardTheme);
  });

  // Restore the previously selected theme
  let savedTheme = "purple";

  try {
    savedTheme =
      localStorage.getItem("chessmate-board-theme") || "purple";
  } catch (error) {
    console.warn("Could not restore the board theme.", error);
  }

  applyBoardTheme(savedTheme);
}

// Initialize board customization
initBoardThemes();
