import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { WorldBuilder } from './world.js';
import { Vehicle } from './vehicle.js';
import { Player } from './player.js';
import { NPCManager } from './npc.js';

// --- 1. SCENE & RENDERER SETUP ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.FogExp2(0x87ceeb, 0.0025);

const camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
document.body.appendChild(renderer.domElement);

// --- 2. REALISTIC LIGHTING ---
const ambientLight = new THREE.HemisphereLight(0xddeeff, 0x202025, 0.7);
scene.add(ambientLight);

const sunLight = new THREE.DirectionalLight(0xfff5e6, 2.8);
sunLight.position.set(120, 180, 100);
sunLight.castShadow = true;
sunLight.shadow.mapSize.width = 4096;
sunLight.shadow.mapSize.height = 4096;
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 500;
const d = 180;
sunLight.shadow.camera.left = -d;
sunLight.shadow.camera.right = d;
sunLight.shadow.camera.top = d;
sunLight.shadow.camera.bottom = -d;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

// --- 3. PHYSICS WORLD ---
const physicsWorld = new CANNON.World();
physicsWorld.gravity.set(0, -9.81, 0);
physicsWorld.broadphase = new CANNON.SAPBroadphase(physicsWorld);
physicsWorld.defaultContactMaterial.friction = 0.3;

// --- 4. INITIALIZE ENTITIES ---
const worldBuilder = new WorldBuilder(scene, physicsWorld);
worldBuilder.build();

const playerCar = new Vehicle(scene, physicsWorld, new CANNON.Vec3(0, 2, 0));
const player = new Player(scene, physicsWorld, camera, new CANNON.Vec3(-3.5, 2, 0));
const npcManager = new NPCManager(scene, physicsWorld);

// --- 5. GAME STATE & INPUTS ---
let gameMode = 'FOOT'; // 'FOOT' or 'CAR'
const keys = { w: false, a: false, s: false, d: false, space: false, shift: false };

const promptEl = document.getElementById('interaction-prompt');
const modeEl = document.getElementById('mode-indicator');
const speedoEl = document.getElementById('speedometer');
const speedValEl = document.getElementById('speed');

window.addEventListener('keydown', (e) => {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = true;
    if (e.code === 'Space') keys.space = true;
    if (e.code === 'ShiftLeft') keys.shift = true;
    if (k === 'f') handleInteraction();
});

window.addEventListener('keyup', (e) => {
    const k = e.key.toLowerCase();
    if (keys.hasOwnProperty(k)) keys[k] = false;
    if (e.code === 'Space') keys.space = false;
    if (e.code === 'ShiftLeft') keys.shift = false;
});

document.body.addEventListener('click', () => {
    document.body.requestPointerLock();
});

function handleInteraction() {
    if (gameMode === 'FOOT') {
        const dist = player.body.position.distanceTo(playerCar.chassisBody.position);
        if (dist < 4.5) {
            gameMode = 'CAR';
            player.disable();
            modeEl.innerText = 'MODE: DRIVING';
            speedoEl.classList.remove('hidden');
            promptEl.classList.add('hidden');
        }
    } else if (gameMode === 'CAR') {
        const speed = playerCar.chassisBody.velocity.length();
        if (speed < 8) { // Prevent jumping out at extreme speeds
            gameMode = 'FOOT';
            // Place player next to the driver's door
            const exitOffset = new CANNON.Vec3(-2.2, 1, 0);
            const worldExitPos = playerCar.chassisBody.pointToWorldFrame(exitOffset);
            player.enable(worldExitPos);
            playerCar.resetControls();
            modeEl.innerText = 'MODE: ON FOOT';
            speedoEl.classList.add('hidden');
        }
    }
}

// --- 6. MAIN LOOP ---
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = Math.min(clock.getDelta(), 0.1);

    // Step Physics
    physicsWorld.step(1 / 60, dt, 3);

    // Update Entities
    npcManager.update(dt);
    playerCar.update(dt, gameMode === 'CAR' ? keys : null);

    if (gameMode === 'FOOT') {
        player.update(dt, keys);
        const dist = player.body.position.distanceTo(playerCar.chassisBody.position);
        if (dist < 4.5) {
            promptEl.classList.remove('hidden');
        } else {
            promptEl.classList.add('hidden');
        }
    } else {
        // Chase from behind the car. The vehicle's front points along local +Z,
        // so the rear camera offset is local -Z.
        const carPos = playerCar.chassisMesh.position;
        const carQuat = playerCar.chassisMesh.quaternion;

        const idealOffset = new THREE.Vector3(0, 2.8, -7.5);
        idealOffset.applyQuaternion(carQuat);
        idealOffset.add(carPos);

        // Look slightly ahead of the car so its rear remains visible in frame.
        const idealLookAt = new THREE.Vector3(0, 1.0, 3.0);
        idealLookAt.applyQuaternion(carQuat);
        idealLookAt.add(carPos);

        camera.position.lerp(idealOffset, Math.min(1, dt * 8));
        camera.lookAt(idealLookAt);

        // Update Speedometer (m/s to MPH)
        const mph = Math.round(playerCar.chassisBody.velocity.length() * 2.23694);
        speedValEl.innerText = mph;
    }

    // Keep Sun shadow centered near player
    const activePos = gameMode === 'FOOT' ? player.mesh.position : playerCar.chassisMesh.position;
    sunLight.position.set(activePos.x + 100, 180, activePos.z + 80);
    sunLight.target.position.copy(activePos);
    sunLight.target.updateMatrixWorld();

    renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
