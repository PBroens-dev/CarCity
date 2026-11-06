import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Player {
    constructor(scene, physicsWorld, camera, spawnPos) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.camera = camera;
        this.active = true;

        this.yaw = 0;
        this.pitch = 0.2;
        this.walkTime = 0;

        this.initPhysics(spawnPos);
        this.initVisuals();
        this.initMouseLook();
    }

    initPhysics(spawnPos) {
        const shape = new CANNON.Sphere(0.5);
        this.body = new CANNON.Body({
            mass: 75,
            shape: shape,
            fixedRotation: true,
            linearDamping: 0.9
        });
        this.body.position.copy(spawnPos);
        this.physicsWorld.addBody(this.body);
    }

    initVisuals() {
        this.mesh = new THREE.Group();

        const shirtMat = new THREE.MeshStandardMaterial({ color: 0x2980b9, roughness: 0.7 });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.6 });
        const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.8 });

        // Torso
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.3), shirtMat);
        torso.position.y = 0.65;
        torso.castShadow = true;
        this.mesh.add(torso);

        // Head
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.35, 0.35), skinMat);
        head.position.y = 1.25;
        head.castShadow = true;
        this.mesh.add(head);

        // Legs
        this.leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.65, 0.25), pantsMat);
        this.leftLeg.position.set(-0.15, 0.1, 0);
        this.leftLeg.castShadow = true;
        this. rightLeg = this.leftLeg.clone();
        this.rightLeg.position.x = 0.15;
        this.mesh.add(this.leftLeg, this.rightLeg);

        this.scene.add(this.mesh);
    }

    initMouseLook() {
        window.addEventListener('mousemove', (e) => {
            if (document.pointerLockElement === document.body && this.active) {
                this.yaw -= e.movementX * 0.0025;
                this.pitch = Math.max(-0.6, Math.min(1.0, this.pitch + e.movementY * 0.0025));
            }
        });
    }

    enable(position) {
        this.active = true;
        this.body.position.copy(position);
        this.body.velocity.set(0, 0, 0);
        this.physicsWorld.addBody(this.body);
        this.mesh.visible = true;
    }

    disable() {
        this.active = false;
        this.physicsWorld.removeBody(this.body);
        this.mesh.visible = false;
    }

    update(dt, keys) {
        if (!this.active) return;

        const speed = keys.shift ? 10 : 5.5;
        const forward = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
        const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).normalize();

        const moveDir = new THREE.Vector3();
        if (keys.w) moveDir.sub(forward);
        if (keys.s) moveDir.add(forward);
        if (keys.d) moveDir.add(right);
        if (keys.a) moveDir.sub(right);

        if (moveDir.lengthSq() > 0) {
            moveDir.normalize();
            this.body.velocity.x = moveDir.x * speed;
            this.body.velocity.z = moveDir.z * speed;

            // Rotate character toward movement direction
            const targetAngle = Math.atan2(moveDir.x, moveDir.z);
            this.mesh.rotation.y = targetAngle;

            // Animate legs
            this.walkTime += dt * (keys.shift ? 14 : 9);
            this.leftLeg.rotation.x = Math.sin(this.walkTime) * 0.6;
            this.rightLeg.rotation.x = -Math.sin(this.walkTime) * 0.6;
        } else {
            this.leftLeg.rotation.x = 0;
            this.rightLeg.rotation.x = 0;
        }

        // Jump
        if (keys.space && Math.abs(this.body.velocity.y) < 0.1 && this.body.position.y < 1.2) {
            this.body.velocity.y = 6.5;
        }

        // Sync Mesh Position
        this.mesh.position.set(this.body.position.x, this.body.position.y - 0.25, this.body.position.z);

        // Orbit Camera around Player
        const camDist = 4.2;
        const camX = this.mesh.position.x + Math.sin(this.yaw) * camDist * Math.cos(this.pitch);
        const camY = this.mesh.position.y + 1.4 + Math.sin(this.pitch) * camDist;
        const camZ = this.mesh.position.z + Math.cos(this.yaw) * camDist * Math.cos(this.pitch);

        this.camera.position.set(camX, Math.max(0.5, camY), camZ);
        this.camera.lookAt(this.mesh.position.x, this.mesh.position.y + 1.1, this.mesh.position.z);
    }
}
