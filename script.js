const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const playerImage = new Image();
playerImage.src = 'pp.gif';
playerImage.addEventListener('error', () => {
  console.error('無法載入主角圖片 pp.gif');
});
const lowFlightImage = new Image();
lowFlightImage.src = '88.png';
lowFlightImage.addEventListener('error', () => {
  console.error('無法載入主角低空飛行動作圖片 88.png');
});
const animationImage = new Image();
animationImage.src = '11.png';
animationImage.addEventListener('error', () => {
  console.error('無法載入主角動作圖片 11.png');
});
const firebirdImage = new Image();
firebirdImage.src = 'https://s.pokeuniv.com/pokemon/sprite/front/146.gif';
firebirdImage.addEventListener('error', () => {
  console.error('無法載入火焰鳥圖片（33.htm 提供的圖鑑來源）');
});

const scoreDisplay = document.getElementById('score');
const bestDisplay = document.getElementById('best');

const GROUND_Y = 230;
const DINO_X = 80;
const DINO_WIDTH = 72;
const DINO_HEIGHT = 54;
const JUMPS_PER_AIRTIME = 2;
const INITIAL_SPEED = 5.5;
const OBSTACLE_INTERVAL_MULTIPLIER = 5;
const DEATH_FRAME_DURATION = 90;
const LOW_FLIGHT_FRAME_DURATION = 90;
const LOW_FLIGHT_COLUMNS = 5;
const LOW_FLIGHT_FRAME_COUNT = 15;
const jumpFrames = [
  { x: 30, y: 295, width: 270, height: 210 },
  { x: 310, y: 225, width: 265, height: 255 },
  { x: 560, y: 140, width: 270, height: 285 },
  { x: 750, y: 10, width: 280, height: 300 },
  { x: 970, y: 140, width: 280, height: 290 },
  { x: 1235, y: 215, width: 285, height: 270 },
  { x: 1490, y: 245, width: 290, height: 265 },
];
const deathFrames = [
  { x: 35, y: 620, width: 225, height: 230 },
  { x: 250, y: 590, width: 260, height: 270 },
  { x: 500, y: 580, width: 290, height: 290 },
  { x: 775, y: 640, width: 280, height: 230 },
  { x: 1030, y: 675, width: 310, height: 205 },
  { x: 1300, y: 710, width: 270, height: 180 },
  { x: 1510, y: 745, width: 279, height: 134 },
];

const state = {
  score: 0,
  best: Number(localStorage.getItem('dinoBest') || 0),
  speed: INITIAL_SPEED,
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
  jumpsRemaining: JUMPS_PER_AIRTIME,
  step: 0,
  lowFlightElapsed: 0,
  deathElapsed: 0,
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
  dino.jumpsRemaining = JUMPS_PER_AIRTIME;
  dino.lowFlightElapsed = 0;
  dino.deathElapsed = 0;
}

function resetGame() {
  state.score = 0;
  state.speed = INITIAL_SPEED;
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

  if (dino.ducking || dino.jumpsRemaining === 0) {
    return;
  }

  dino.velocityY = dino.jumpPower;
  dino.grounded = false;
  dino.jumpsRemaining -= 1;
}

function duck(active) {
  if (state.gameOver) {
    return;
  }

  if (active && !dino.ducking) {
    dino.lowFlightElapsed = 0;
  }
  dino.ducking = active;
  if (dino.grounded) {
    dino.height = active ? 30 : DINO_HEIGHT;
    dino.y = GROUND_Y - dino.height;
  }
}

function spawnObstacle() {
  const birdChance = Math.random();

  if (birdChance < 0.12) {
    const width = 40;
    const height = 34;
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
  dino.ducking = false;
  dino.height = DINO_HEIGHT;
  dino.y = GROUND_Y - dino.height;
  dino.velocityY = 0;
  dino.deathElapsed = 0;
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
    dino.deathElapsed = Math.min(
      dino.deathElapsed + delta * 16.67,
      deathFrames.length * DEATH_FRAME_DURATION,
    );
    return;
  }

  state.speed += 0.0015 * delta;
  setScore(state.score + 0.12 * delta);

  dino.step += delta;
  if (dino.ducking) {
    dino.lowFlightElapsed += delta * 16.67;
  }
  dino.velocityY += dino.gravity * delta;
  dino.y += dino.velocityY * delta;

  if (dino.y >= GROUND_Y - dino.height) {
    dino.y = GROUND_Y - dino.height;
    dino.velocityY = 0;
    dino.grounded = true;
    dino.jumpsRemaining = JUMPS_PER_AIRTIME;
    if (dino.ducking) {
      dino.height = 30;
      dino.y = GROUND_Y - dino.height;
    }
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
    state.spawnTimer =
      (randomBetween(90, 150) * OBSTACLE_INTERVAL_MULTIPLIER) /
      Math.min(state.speed * 1.15, 10.5);
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
  const haze = ctx.createRadialGradient(x + 18 * scale, y, 2, x + 18 * scale, y, 42 * scale);
  haze.addColorStop(0, 'rgba(44, 131, 190, 0.16)');
  haze.addColorStop(1, 'rgba(44, 131, 190, 0)');
  ctx.fillStyle = haze;
  ctx.beginPath();
  ctx.ellipse(x + 18 * scale, y, 42 * scale, 26 * scale, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawGround() {
  const groundTop = 230;
  const ground = ctx.createLinearGradient(0, groundTop, 0, canvas.height);
  ground.addColorStop(0, '#101b2e');
  ground.addColorStop(1, '#070b16');
  ctx.fillStyle = ground;
  ctx.fillRect(0, groundTop, canvas.width, canvas.height - groundTop);

  ctx.save();
  ctx.shadowColor = '#32d9ff';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#37dfff';
  ctx.fillRect(0, groundTop, canvas.width, 2);

  ctx.strokeStyle = 'rgba(95, 211, 255, 0.56)';
  ctx.lineWidth = 1;
  ctx.setLineDash([14, 12]);
  ctx.beginPath();
  ctx.moveTo(0, groundTop + 14);
  ctx.lineTo(canvas.width, groundTop + 14);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

function drawHills() {
  const farGlow = ctx.createLinearGradient(0, 140, 0, 235);
  farGlow.addColorStop(0, '#13243d');
  farGlow.addColorStop(1, '#101b32');
  ctx.fillStyle = farGlow;
  ctx.beginPath();
  ctx.moveTo(0, 220);
  ctx.quadraticCurveTo(130, 155, 260, 220);
  ctx.quadraticCurveTo(420, 170, 560, 220);
  ctx.quadraticCurveTo(720, 155, 880, 220);
  ctx.quadraticCurveTo(920, 190, 960, 220);
  ctx.lineTo(960, 300);
  ctx.lineTo(0, 300);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = 'rgba(52, 111, 171, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, 220);
  ctx.quadraticCurveTo(130, 155, 260, 220);
  ctx.quadraticCurveTo(420, 170, 560, 220);
  ctx.quadraticCurveTo(720, 155, 880, 220);
  ctx.quadraticCurveTo(920, 190, 960, 220);
  ctx.stroke();

  ctx.fillStyle = '#0d172a';
  ctx.beginPath();
  ctx.moveTo(0, 240);
  ctx.quadraticCurveTo(150, 198, 300, 240);
  ctx.quadraticCurveTo(500, 214, 680, 240);
  ctx.quadraticCurveTo(830, 194, 960, 240);
  ctx.lineTo(960, 300);
  ctx.lineTo(0, 300);
  ctx.closePath();
  ctx.fill();

  const skyline = [
    [26, 18], [60, 30], [104, 22], [151, 37], [205, 24], [257, 32],
    [318, 19], [365, 34], [426, 23], [478, 40], [538, 25], [590, 33],
    [650, 20], [698, 36], [758, 24], [812, 31], [868, 20], [916, 35],
  ];
  const offset = (performance.now() * 0.012) % 50;
  for (let i = 0; i < skyline.length; i += 1) {
    const [baseX, height] = skyline[i];
    const x = ((baseX - offset + canvas.width) % canvas.width) - 20;
    const buildingY = 226 - height;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(22, 38, 69, 0.8)' : 'rgba(13, 26, 52, 0.86)';
    ctx.fillRect(x, buildingY, 18, height);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(59, 209, 255, 0.7)' : 'rgba(127, 112, 255, 0.62)';
    for (let row = 0; row < Math.floor(height / 9); row += 1) {
      ctx.globalAlpha = 0.55 + (Math.sin(performance.now() * 0.003 + i + row) + 1) * 0.18;
      ctx.fillRect(x + 4, buildingY + 5 + row * 8, 3, 2);
      ctx.fillRect(x + 11, buildingY + 5 + row * 8, 3, 2);
    }
    ctx.globalAlpha = 1;
  }
}

function drawBackgroundDetails() {
  const time = performance.now() * 0.001;

  ctx.save();
  ctx.globalAlpha = 0.26;
  ctx.strokeStyle = '#2e6d99';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i += 1) {
    const y = 145 + i * 13;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(
      250,
      y - 14 + Math.sin(time + i) * 3,
      660,
      y + 10 - Math.sin(time * 0.7 + i) * 3,
      canvas.width,
      y - 5,
    );
    ctx.stroke();
  }

  for (let i = 0; i < 18; i += 1) {
    const x = (i * 71 + time * (12 + (i % 4) * 4)) % canvas.width;
    const y = 125 + ((i * 47) % 95);
    const pulse = 0.55 + (Math.sin(time * 2 + i) + 1) * 0.22;
    ctx.globalAlpha = pulse;
    ctx.fillStyle = i % 3 === 0 ? '#45eaff' : '#6f8aff';
    ctx.shadowColor = ctx.fillStyle;
    ctx.shadowBlur = 8;
    ctx.fillRect(x, y, i % 3 === 0 ? 3 : 2, 2);
  }

  ctx.globalAlpha = 0.22;
  ctx.shadowBlur = 0;
  for (let i = 0; i < 12; i += 1) {
    const x = i * 88 - ((time * 18) % 88);
    ctx.strokeStyle = i % 2 === 0 ? '#246994' : '#433b9a';
    ctx.beginPath();
    ctx.moveTo(x, 215);
    ctx.lineTo(x + 34, 178 + (i % 3) * 9);
    ctx.lineTo(x + 70, 215);
    ctx.stroke();
  }
  ctx.restore();
}

function drawDino() {
  if (dino.ducking && lowFlightImage.complete && lowFlightImage.naturalWidth > 0) {
    const frameIndex = Math.min(
      Math.floor(dino.lowFlightElapsed / LOW_FLIGHT_FRAME_DURATION) %
        LOW_FLIGHT_FRAME_COUNT,
      LOW_FLIGHT_FRAME_COUNT - 1,
    );
    const frameWidth = lowFlightImage.naturalWidth / LOW_FLIGHT_COLUMNS;
    const frameHeight = lowFlightImage.naturalHeight / 3;
    const characterWidth = DINO_WIDTH * 1.22;
    const characterHeight = DINO_HEIGHT * 1.22;
    const characterX = dino.x - (characterWidth - DINO_WIDTH) / 2;
    const characterY = dino.y - (characterHeight - dino.height);

    ctx.drawImage(
      lowFlightImage,
      (frameIndex % LOW_FLIGHT_COLUMNS) * frameWidth,
      Math.floor(frameIndex / LOW_FLIGHT_COLUMNS) * frameHeight,
      frameWidth,
      frameHeight,
      characterX,
      characterY,
      characterWidth,
      characterHeight,
    );
    return;
  }

  const characterWidth = dino.width * 1.22;
  const characterHeight = dino.height * 1.22;
  const characterX = dino.x - (characterWidth - dino.width) / 2;
  const characterY = dino.y - (characterHeight - dino.height);
  const halo = ctx.createRadialGradient(
    dino.x + dino.width / 2,
    dino.y + dino.height / 2,
    2,
    dino.x + dino.width / 2,
    dino.y + dino.height / 2,
    characterWidth * 0.72,
  );
  halo.addColorStop(0, 'rgba(44, 220, 255, 0.24)');
  halo.addColorStop(0.55, 'rgba(53, 119, 255, 0.13)');
  halo.addColorStop(1, 'rgba(53, 119, 255, 0)');
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.ellipse(
    dino.x + dino.width / 2,
    dino.y + dino.height / 2,
    characterWidth * 0.72,
    characterHeight * 0.78,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fill();

  let drewCharacter = false;
  if (animationImage.complete && animationImage.naturalWidth > 0) {
    let frame;
    if (state.gameOver) {
      const frameIndex = Math.min(
        Math.floor(dino.deathElapsed / DEATH_FRAME_DURATION),
        deathFrames.length - 1,
      );
      frame = deathFrames[frameIndex];
    } else if (!dino.grounded) {
      const jumpHeight = Math.max(GROUND_Y - dino.height - dino.y, 0);
      const maxJumpHeight = (dino.jumpPower * dino.jumpPower) / (2 * dino.gravity);
      const progress = Math.min(jumpHeight / maxJumpHeight, 1);
      const frameIndex =
        dino.velocityY < 0
          ? Math.round(progress * (jumpFrames.length - 1) / 2)
          : Math.ceil((jumpFrames.length - 1) / 2) +
            Math.round((1 - progress) * (jumpFrames.length - 1) / 2);
      frame = jumpFrames[Math.min(frameIndex, jumpFrames.length - 1)];
    }

    if (frame) {
      ctx.save();
      ctx.shadowColor = '#42ddff';
      ctx.shadowBlur = 25;
      ctx.filter = 'saturate(1.35) brightness(1.18)';
      ctx.drawImage(
        animationImage,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        characterX,
        characterY,
        characterWidth,
        characterHeight,
      );
      ctx.restore();
      drewCharacter = true;
    }
  }

  if (!drewCharacter && playerImage.complete && playerImage.naturalWidth > 0) {
    ctx.save();
    ctx.shadowColor = '#42ddff';
    ctx.shadowBlur = 26;
    ctx.filter = 'saturate(1.35) brightness(1.18)';
    ctx.drawImage(playerImage, characterX, characterY, characterWidth, characterHeight);
    ctx.restore();
  }
}

function drawCactus(obstacle) {
  const x = obstacle.x;
  const y = obstacle.y;
  const width = obstacle.width;
  const height = obstacle.height;
  const flamePhase = performance.now() * 0.008 + x * 0.12;
  const flicker = Math.sin(flamePhase) * 2;

  ctx.save();
  ctx.shadowColor = '#078dff';
  ctx.shadowBlur = 18;
  const outerFlame = ctx.createLinearGradient(x, y, x, y + height);
  outerFlame.addColorStop(0, '#66f6ff');
  outerFlame.addColorStop(0.42, '#168dff');
  outerFlame.addColorStop(1, '#153be0');
  ctx.fillStyle = outerFlame;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.5, y - 8 - flicker);
  ctx.bezierCurveTo(x + width * 0.8, y + 2, x + width * 0.55, y + height * 0.18, x + width * 0.88, y + height * 0.34);
  ctx.bezierCurveTo(x + width * 1.12, y + height * 0.57, x + width * 0.78, y + height * 0.83, x + width, y + height);
  ctx.lineTo(x, y + height);
  ctx.bezierCurveTo(x + width * 0.24, y + height * 0.76, x - width * 0.12, y + height * 0.58, x + width * 0.15, y + height * 0.39);
  ctx.bezierCurveTo(x + width * 0.36, y + height * 0.23, x + width * 0.24, y + height * 0.08, x + width * 0.5, y - 8 - flicker);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 5;
  const innerFlame = ctx.createLinearGradient(x, y + height * 0.2, x, y + height);
  innerFlame.addColorStop(0, '#e4ffff');
  innerFlame.addColorStop(0.55, '#60f5ff');
  innerFlame.addColorStop(1, 'rgba(34, 177, 255, 0.15)');
  ctx.fillStyle = innerFlame;
  ctx.beginPath();
  ctx.moveTo(x + width * 0.53, y + height * 0.25);
  ctx.bezierCurveTo(x + width * 0.76, y + height * 0.47, x + width * 0.62, y + height * 0.7, x + width * 0.79, y + height);
  ctx.lineTo(x + width * 0.2, y + height);
  ctx.bezierCurveTo(x + width * 0.42, y + height * 0.7, x + width * 0.28, y + height * 0.5, x + width * 0.53, y + height * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawBird(obstacle) {
  if (firebirdImage.complete && firebirdImage.naturalWidth > 0) {
    ctx.save();
    ctx.shadowColor = '#ff7547';
    ctx.shadowBlur = 12;
    ctx.drawImage(
      firebirdImage,
      obstacle.x,
      obstacle.y - 4,
      obstacle.width,
      obstacle.height + 8,
    );
    ctx.restore();
    return;
  }

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
  ctx.fillStyle = 'rgba(2, 5, 16, 0.48)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#e9f8ff';
  ctx.shadowColor = '#32bfff';
  ctx.shadowBlur = 14;
  ctx.textAlign = 'center';
  ctx.font = 'bold 26px Segoe UI';
  ctx.fillText('PP 倒下了！按空白鍵重玩', canvas.width / 2, canvas.height / 2);
  ctx.shadowBlur = 0;
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const sky = ctx.createLinearGradient(0, 0, 0, 300);
  sky.addColorStop(0, '#080b18');
  sky.addColorStop(0.58, '#10152b');
  sky.addColorStop(1, '#1b2440');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, 300);

  const stars = [
    [42, 42, 1.2], [118, 101, 1], [184, 34, 1.4], [270, 76, 0.9],
    [352, 42, 1.1], [418, 112, 1.3], [512, 55, 0.9], [592, 94, 1.2],
    [672, 38, 1], [748, 113, 1.4], [815, 48, 0.9], [920, 104, 1.2],
  ];
  for (const [x, y, radius] of stars) {
    ctx.globalAlpha = 0.5 + (Math.sin(performance.now() * 0.002 + x) + 1) * 0.22;
    ctx.fillStyle = '#a8eaff';
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const moonGlow = ctx.createRadialGradient(860, 68, 3, 860, 68, 54);
  moonGlow.addColorStop(0, 'rgba(63, 198, 255, 0.38)');
  moonGlow.addColorStop(1, 'rgba(63, 198, 255, 0)');
  ctx.fillStyle = moonGlow;
  ctx.beginPath();
  ctx.arc(860, 68, 54, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#a7eaff';
  ctx.shadowColor = '#36bfff';
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(860, 68, 18, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;

  for (const cloud of clouds) {
    drawCloud(cloud);
  }

  drawBackgroundDetails();
  drawHills();
  drawGround();
  drawObstacles();
  drawDino();
  drawParticles();

  if (
    state.gameOver &&
    dino.deathElapsed >= deathFrames.length * DEATH_FRAME_DURATION
  ) {
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
