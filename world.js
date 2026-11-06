import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class WorldBuilder {
    constructor(scene, physicsWorld) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
    }

    build() {
        this.createGround();
        this.createCityGrid();
    }

    createGround() {
        // Physics Ground
        const groundShape = new CANNON.Plane();
        const groundBody = new CANNON.Body({ mass: 0 });
        groundBody.addShape(groundShape);
        groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
        this.physicsWorld.addBody(groundBody);

        // Visual Asphalt Base
        const geo = new THREE.PlaneGeometry(1200, 1200);
        const mat = new THREE.MeshStandardMaterial({ 
            color: 0x222428, 
            roughness: 0.85,
            metalness: 0.1 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.rotation.x = -Math.PI / 2;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
    }

    createBuildingTexture() {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 512;
        const ctx = canvas.getContext('2d');

        ctx.fillStyle = '#2c3540';
        ctx.fillRect(0, 0, 256, 512);

        for (let y = 16; y < 500; y += 32) {
            for (let x = 16; x < 240; x += 32) {
                const isLit = Math.random() > 0.35;
                ctx.fillStyle = isLit ? '#a8c8e8' : '#151a21';
                ctx.fillRect(x, y, 20, 24);
            }
        }
        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    createCityGrid() {
        const blockSize = 46;
        const streetWidth = 18;
        const step = blockSize + streetWidth;
        const gridCount = 5; // 11x11 grid

        const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0x7a7e85, roughness: 0.7 });
        const grassMat = new THREE.MeshStandardMaterial({ color: 0x3b6e38, roughness: 0.9 });
        const buildingTex = this.createBuildingTexture();

        for (let gx = -gridCount; gx <= gridCount; gx++) {
            for (let gz = -gridCount; gz <= gridCount; gz++) {
                // Leave immediate center clear for player spawn road
                if (gx === 0 && gz === 0) continue;

                const centerX = gx * step;
                const centerZ = gz * step;

                // Sidewalk slab
                const swGeo = new THREE.BoxGeometry(blockSize, 0.3, blockSize);
                const swMesh = new THREE.Mesh(swGeo, sidewalkMat);
                swMesh.position.set(centerX, 0.15, centerZ);
                swMesh.receiveShadow = true;
                swMesh.castShadow = true;
                this.scene.add(swMesh);

                const swShape = new CANNON.Box(new CANNON.Vec3(blockSize / 2, 0.15, blockSize / 2));
                const swBody = new CANNON.Body({ mass: 0 });
                swBody.addShape(swShape);
                swBody.position.set(centerX, 0.15, centerZ);
                this.physicsWorld.addBody(swBody);

                // Decide between Park block or Skyscraper block
                if (Math.random() < 0.22) {
                    this.createPark(centerX, centerZ, blockSize - 4, grassMat);
                } else {
                    this.createBuildings(centerX, centerZ, blockSize - 6, buildingTex);
                }
            }
        }
    }

    createBuildings(cx, cz, size, texture) {
        const height = 20 + Math.random() * 65;
        const bGeo = new THREE.BoxGeometry(size, height, size);
        
        const bMat = new THREE.MeshStandardMaterial({
            map: texture,
            roughness: 0.25,
            metalness: 0.4
        });

        const mesh = new THREE.Mesh(bGeo, bMat);
        mesh.position.set(cx, height / 2 + 0.3, cz);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);

        const shape = new CANNON.Box(new CANNON.Vec3(size / 2, height / 2, size / 2));
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(shape);
        body.position.copy(mesh.position);
        this.physicsWorld.addBody(body);
    }

    createPark(cx, cz, size, grassMat) {
        const grassGeo = new THREE.BoxGeometry(size, 0.1, size);
        const grassMesh = new THREE.Mesh(grassGeo, grassMat);
        grassMesh.position.set(cx, 0.35, cz);
        grassMesh.receiveShadow = true;
        this.scene.add(grassMesh);

        // Add Trees
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
        const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2d5a27, roughness: 0.8 });

        for (let i = 0; i < 6; i++) {
            const tx = cx + (Math.random() - 0.5) * (size - 6);
            const tz = cz + (Math.random() - 0.5) * (size - 6);

            const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.4, 3, 8), trunkMat);
            trunk.position.set(tx, 1.8, tz);
            trunk.castShadow = true;
            this.scene.add(trunk);

            const crown = new THREE.Mesh(new THREE.DodecahedronGeometry(2.2, 1), leavesMat);
            crown.position.set(tx, 4.2, tz);
            crown.castShadow = true;
            this.scene.add(crown);
        }
    }
}
