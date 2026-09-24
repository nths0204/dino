const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const scoreDisplay = document.getElementById('score');
const bestDisplay = document.getElementById('best');

const GROUND_Y = 230;
const DINO_X = 80;
const DINO_WIDTH = 40;
const DINO_HEIGHT = 42;

const state = {
  score: 0,
  best: Number(localStorage.getItem('dinoBest') || 0),
  speed: 7,
  spawnTimer: 0,
  gameOver: false,
  lastTime: 0,
};

const particles = [];

const clouds = [
  { x: 90, y: 58, scale: 1 },
  { x: 330, y: 82, scale: 0.8 },
  { x: 620, y: 52, scale: 1.1 },
  { x: 830, y: 90, scale: 0.9 },
];

const dino = {
  x: DINO_X,
  y: GROUND_Y - DINO_HEIGHT,
  width: DINO_WIDTH,
  height: DINO_HEIGHT,
  velocityY: 0,
  gravity: 0.9,
  jumpPower: -15,
  grounded: true,
  ducking: false,
  step: 0,
};

const obstacles = [];

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function updateBestDisplay() {
  bestDisplay.textContent = state.best;
}

function setScore(value) {
  state.score = value;
  scoreDisplay.textContent = Math.floor(state.score);
}

function resetDino() {
  dino.grounded = true;
  dino.ducking = false;
  dino.height = DINO_HEIGHT;
  dino.y = GROUND_Y - dino.height;
  dino.velocityY = 0;
}

function resetGame() {
  state.score = 0;
  state.speed = 7;
  state.spawnTimer = 0;
  state.gameOver = false;
  obstacles.length = 0;
  particles.length = 0;
  setScore(0);
  resetDino();
}

function spawnDeathParticles() {
  const cx = dino.x + dino.width / 2;
  const cy = dino.y + dino.height / 2;
  const palette = ['#f3d76d', '#ef8c4a', '#d65b3c', '#2b2b2b', '#f7f7f7'];

  for (let i = 0; i < 28; i += 1) {
    const angle = randomBetween(0, Math.PI * 2);
    const speed = randomBetween(1.1, 5.8);
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 1.3,
      life: randomBetween(30, 52),
      size: randomBetween(3, 8),
      color: palette[Math.floor(Math.random() * palette.length)],
    });
  }
}

function updateParticles(delta) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vy += 0.12 * delta;
    particle.life -= delta;

    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

function jump() {
  if (state.gameOver) {
    resetGame();
    return;
  }

  if (!dino.grounded || dino.ducking) {
    return;
  }

  dino.velocityY = dino.jumpPower;
  dino.grounded = false;
}

function duck(active) {
  if (state.gameOver || !dino.grounded) {
    return;
  }

  dino.ducking = active;
  if (active) {
    dino.height = 24;
    dino.y = GROUND_Y - dino.height;
  } else {
    dino.height = DINO_HEIGHT;
    dino.y = GROUND_Y - dino.height;
  }
}

function spawnObstacle() {
  const birdChance = Math.random();

  if (birdChance < 0.12) {
    const width = 38;
    const height = 24;
    const yBase = Math.random() > 0.5 ? GROUND_Y - 80 : GROUND_Y - 116;
    obstacles.push({
      x: canvas.width + 20,
      y: yBase,
      width,
      height,
      type: 'bird',
      flap: 0,
    });
    return;
  }

  const clusterSize = Math.random() < 0.82 ? 1 : 2;
  const baseX = canvas.width + 26;

  for (let i = 0; i < clusterSize; i += 1) {
    const width = randomBetween(18, 28);
    const height = randomBetween(24, 44);
    obstacles.push({
      x: baseX + i * randomBetween(42, 60),
      y: GROUND_Y - height,
      width,
      height,
      type: 'cactus',
    });
  }
}

function intersects(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function endGame() {
  if (state.gameOver) {
    return;
  }

  state.gameOver = true;
  spawnDeathParticles();

  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem('dinoBest', String(state.best));
    updateBestDisplay();
  }
}

function update(delta) {
  updateParticles(delta);

  if (state.gameOver) {
    return;
  }

  state.speed += 0.0035 * delta;
  setScore(state.score + 0.12 * delta);

  dino.step += delta;
  dino.velocityY += dino.gravity * delta;
  dino.y += dino.velocityY * delta;

  if (dino.y >= GROUND_Y - dino.height) {
    dino.y = GROUND_Y - dino.height;
    dino.velocityY = 0;
    dino.grounded = true;
  }

  for (const cloud of clouds) {
    cloud.x -= 0.4 * delta;
    if (cloud.x < -160) {
      cloud.x = canvas.width + 60;
      cloud.y = randomBetween(35, 100);
    }
  }

  state.spawnTimer -= delta;
  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = randomBetween(90, 150) / Math.min(state.speed * 1.15, 10.5);
  }

  for (let i = obstacles.length - 1; i >= 0; i--) {
    const obstacle = obstacles[i];
    obstacle.x -= state.speed * delta;

    if (obstacle.type === 'bird') {
      obstacle.flap += delta * 0.08;
      obstacle.y += Math.sin(obstacle.flap) * 0.85;
    }

    const dinoRect = {
      x: dino.x + 6,
      y: dino.y + 4,
      width: dino.width - 12,
      height: dino.height - 6,
    };

    const obstacleRect = {
      x: obstacle.x + 2,
      y: obstacle.y + 2,
      width: obstacle.width - 4,
      height: obstacle.height - 4,
    };

    if (intersects(dinoRect, obstacleRect)) {
      endGame();
      break;
    }

    if (obstacle.x + obstacle.width < -30) {
      obstacles.splice(i, 1);
      if (!state.gameOver) {
        state.score += 1;
        scoreDisplay.textContent = state.score;
      }
    }
  }
}

function drawCloud(cloud) {
  const { x, y, scale } = cloud;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.beginPath();
  ctx.arc(x, y, 18 * scale, 0, Math.PI * 2);
  ctx.arc(x + 18 * scale, y - 8 * scale, 14 * scale, 0, Math.PI * 2);
  ctx.arc(x + 36 * scale, y, 16 * scale, 0, Math.PI * 2);
  ctx.arc(x + 16 * scale, y + 6 * scale, 18 * scale, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround() {
  const groundTop = 230;
  ctx.fillStyle = '#8c8c8c';
  ctx.fillRect(0, groundTop, canvas.width, canvas.height - groundTop);

  ctx.fillStyle = '#666';
  ctx.fillRect(0, groundTop, canvas.width, 4);

  ctx.strokeStyle = '#f5f5f5';
  ctx.lineWidth = 2;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(0, groundTop + 8);
  ctx.lineTo(canvas.width, groundTop + 8);
  ctx.stroke();
  ctx.setLineDash([]);
}

function drawHills() {
  ctx.fillStyle = '#cfe7bf';
  ctx.beginPath();
  ctx.moveTo(0, 220);
  ctx.quadraticCurveTo(130, 130, 260, 220);
  ctx.quadraticCurveTo(420, 150, 560, 220);
  ctx.quadraticCurveTo(720, 150, 880, 220);
  ctx.quadraticCurveTo(920, 190, 960, 220);
  ctx.lineTo(960, 300);
  ctx.lineTo(0, 300);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#b7d7a5';
  ctx.beginPath();
  ctx.moveTo(0, 240);
  ctx.quadraticCurveTo(150, 180, 300, 240);
  ctx.quadraticCurveTo(500, 200, 680, 240);
  ctx.quadraticCurveTo(830, 200, 960, 240);
  ctx.lineTo(960, 300);
  ctx.lineTo(0, 300);
  ctx.closePath();
  ctx.fill();
}

function drawDino() {
  const bodyColor = '#d98c52';
  const dark = '#312820';
  const cream = '#f4e9d7';
  const shieldBlue = '#7a97af';
  const legSwing = Math.sin(dino.step * 0.32) * 4;
  const bodyY = dino.y + (dino.ducking ? 8 : 0);

  ctx.fillStyle = dark;
  ctx.beginPath();
  ctx.moveTo(dino.x + 4, bodyY + 18);
  ctx.lineTo(dino.x - 8, bodyY + 12);
  ctx.lineTo(dino.x + 2, bodyY + 24);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = bodyColor;
  ctx.fillRect(dino.x + 8, bodyY + 10, 22, 18);
  ctx.fillRect(dino.x + 20, bodyY + 4, 20, 16);
  ctx.fillRect(dino.x + 13, bodyY + 26, 8, 8);
  ctx.fillRect(dino.x + 25, bodyY + 26, 8, 8);

  if (!dino.ducking) {
    ctx.fillStyle = dark;
    ctx.fillRect(dino.x + 9, bodyY + 30, 6, 12 + legSwing * 0.18);
    ctx.fillRect(dino.x + 24, bodyY + 30, 6, 12 - legSwing * 0.18);
  } else {
    ctx.fillStyle = dark;
    ctx.fillRect(dino.x + 10, bodyY + 24, 6, 10);
    ctx.fillRect(dino.x + 25, bodyY + 24, 6, 10);
  }

  ctx.fillStyle = bodyColor;
  ctx.fillRect(dino.x + 31, bodyY - 3, 18, 16);
  ctx.fillStyle = cream;
  ctx.fillRect(dino.x + 35, bodyY + 2, 7, 6);
  ctx.fillStyle = dark;
  ctx.fillRect(dino.x + 39, bodyY + 4, 2, 2);
  ctx.fillRect(dino.x + 34, bodyY + 5, 2, 2);

  ctx.fillStyle = bodyColor;
  ctx.beginPath();
  ctx.moveTo(dino.x + 31, bodyY + 2);
  ctx.lineTo(dino.x + 27, bodyY - 7);
  ctx.lineTo(dino.x + 34, bodyY - 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(dino.x + 43, bodyY + 2);
  ctx.lineTo(dino.x + 47, bodyY - 7);
  ctx.lineTo(dino.x + 40, bodyY - 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f5c9a8';
  ctx.fillRect(dino.x + 33, bodyY + 9, 10, 5);
  ctx.fillStyle = dark;
  ctx.fillRect(dino.x + 38, bodyY + 11, 2, 2);

  ctx.fillStyle = dark;
  ctx.fillRect(dino.x + 3, bodyY + 13, 8, 6);
  ctx.fillStyle = shieldBlue;
  ctx.beginPath();
  ctx.moveTo(dino.x + 3, bodyY + 18);
  ctx.lineTo(dino.x - 8, bodyY + 12);
  ctx.lineTo(dino.x - 8, bodyY + 28);
  ctx.lineTo(dino.x + 3, bodyY + 34);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#dfeaf3';
  ctx.beginPath();
  ctx.arc(dino.x - 4, bodyY + 22, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.translate(dino.x + 43, bodyY + 18);
  ctx.rotate(dino.ducking ? 1.2 : 0.85);
  ctx.fillStyle = '#dfeaf3';
  ctx.fillRect(0, -2, 26, 4);
  ctx.fillStyle = '#9c7e50';
  ctx.fillRect(18, -5, 4, 10);
  ctx.fillRect(12, -6, 5, 12);
  ctx.restore();
}

function drawCactus(obstacle) {
  ctx.fillStyle = '#2f7d32';
  ctx.fillRect(obstacle.x + 8, obstacle.y + 12, 8, obstacle.height - 12);
  ctx.fillRect(obstacle.x + 2, obstacle.y + 18, 20, 8);
  ctx.fillRect(obstacle.x + 16, obstacle.y + 6, 8, obstacle.height - 6);

  ctx.fillStyle = '#5ebd64';
  ctx.fillRect(obstacle.x + 10, obstacle.y + 16, 4, obstacle.height - 18);
  ctx.fillRect(obstacle.x + 18, obstacle.y + 18, 4, obstacle.height - 20);
}

function drawBird(obstacle) {
  const wing = Math.sin(obstacle.flap) * 5;
  ctx.fillStyle = '#2d2d2d';
  ctx.beginPath();
  ctx.moveTo(obstacle.x, obstacle.y + obstacle.height / 2);
  ctx.lineTo(obstacle.x + 18, obstacle.y - 8 + wing);
  ctx.lineTo(obstacle.x + 30, obstacle.y + obstacle.height / 2);
  ctx.lineTo(obstacle.x + 18, obstacle.y + 4 + wing);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f3f3f3';
  ctx.fillRect(obstacle.x + 30, obstacle.y + 8, 4, 3);
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(obstacle.x + 33, obstacle.y + 8, 2, 2);
}

function drawObstacles() {
  for (const obstacle of obstacles) {
    if (obstacle.type === 'cactus') {
      drawCactus(obstacle);
    } else {
      drawBird(obstacle);
    }
  }
}

function drawParticles() {
  for (const particle of particles) {
    const alpha = Math.max(particle.life / 50, 0);
    ctx.fillStyle = particle.color;
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawGameOverText() {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#121212';
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px Segoe UI';
  ctx.fillText('柴犬倒下了！按空白鍵重玩', canvas.width / 2, canvas.height / 2);
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#edf5fb');
  sky.addColorStop(0.6, '#edf5fb');
  sky.addColorStop(1, '#e2e8ed');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, 300);

  ctx.fillStyle = 'rgba(255, 210, 66, 0.8)';
  ctx.beginPath();
  ctx.arc(860, 68, 26, 0, Math.PI * 2);
  ctx.fill();

  for (const cloud of clouds) {
    drawCloud(cloud);
  }

  drawHills();
  drawGround();
  drawObstacles();
  drawDino();
  drawParticles();

  if (state.gameOver) {
    drawGameOverText();
  }
}

function frame(time) {
  if (!state.lastTime) {
    state.lastTime = time;
  }

  const delta = Math.min((time - state.lastTime) / 16.67, 2.2);
  state.lastTime = time;

  update(delta);
  render();
  requestAnimationFrame(frame);
}

window.addEventListener('keydown', (event) => {
  if (['Space', 'ArrowUp', 'KeyW'].includes(event.code)) {
    event.preventDefault();
    jump();
  }

  if (['ArrowDown', 'KeyS'].includes(event.code)) {
    event.preventDefault();
    duck(true);
  }
});

window.addEventListener('keyup', (event) => {
  if (['ArrowDown', 'KeyS'].includes(event.code)) {
    duck(false);
  }
});

canvas.addEventListener('pointerdown', () => {
  if (state.gameOver) {
    resetGame();
    return;
  }

  jump();
});

updateBestDisplay();
resetGame();
requestAnimationFrame(frame);
