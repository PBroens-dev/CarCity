import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class NPCManager {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.pedestrians = [];
        this.trafficCars = [];

        this.spawnPedestrians(45);
        this.spawnTraffic(14);
    }

    spawnPedestrians(count) {
        const colors = [0xe67e22, 0x9b59b6, 0x2ecc71, 0xf1c40f, 0x34495e, 0xe74c3c];
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xe0ac69 });

        for (let i = 0; i < count; i++) {
            const group = new THREE.Group();
            const mat = new THREE.MeshStandardMaterial({ color: colors[i % colors.length], roughness: 0.8 });

            const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.3), mat);
            body.position.y = 0.55;
            body.castShadow = true;

            const head = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.32, 0.32), skinMat);
            head.position.y = 1.3;
            head.castShadow = true;

            group.add(body, head);

            // Spawn along sidewalks
            const x = (Math.floor(Math.random() * 6) - 3) * 64 + 20;
            const z = (Math.random() - 0.5) * 300;
            group.position.set(x, 0.3, z);
            this.scene.add(group);

            const dir = Math.random() > 0.5 ? 1 : -1;
            this.pedestrians.push({ mesh: group, dir: dir, speed: 1.5 + Math.random() * 1.2 });
        }
    }

    spawnTraffic(count) {
        const carColors = [0x2980b9, 0x27ae60, 0x8e44ad, 0xf39c12, 0x7f8c8d, 0xffffff];
        const step = 64; // Matches WorldBuilder grid step

        for (let i = 0; i < count; i++) {
            const color = carColors[i % carColors.length];
            const mesh = new THREE.Group();

            const bodyMat = new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.3, clearcoat: 0.8 });
            const base = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.8, 4.2), bodyMat);
            base.position.y = 0.5;
            base.castShadow = true;

            const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 2.0), new THREE.MeshStandardMaterial({ color: 0x111111 }));
            top.position.set(0, 1.1, -0.2);
            mesh.add(base, top);

            // Put traffic on straight avenues
            const laneIndex = Math.floor(Math.random() * 5) - 2;
            const x = laneIndex * step + ( step / 2 ); 
            const z = (Math.random() - 0.5) * 350;

            mesh.position.set(x, 0, z);
            this.scene.add(mesh);

            // Physics kinematic box so player car can crash into traffic
            const shape = new CANNON.Box(new CANNON.Vec3(1.0, 0.7, 2.1));
            const body = new CANNON.Body({ mass: 1000 });
            body.addShape(shape, new CANNON.Vec3(0, 0.7, 0));
            body.position.set(x, 0.2, z);
            this.physicsWorld.addBody(body);

            this.trafficCars.push({ mesh, body, speed: 9 + Math.random() * 5 });
        }
    }

    update(dt) {
        // Update Pedestrians
        for (const p of this.pedestrians) {
            p.mesh.position.z += p.dir * p.speed * dt;
            p.mesh.rotation.y = p.dir > 0 ? 0 : Math.PI;
            if (Math.abs(p.mesh.position.z) > 220) p.dir *= -1;
        }

        // Update AI Traffic Cars
        for (const car of this.trafficCars) {
            car.body.velocity.z = car.speed;
            car.body.velocity.x *= 0.9;

            if (car.body.position.z > 250) {
                car.body.position.z = -250;
            }

            car.mesh.position.copy(car.body.position);
            car.mesh.quaternion.copy(car.body.quaternion);
        }
    }
}
