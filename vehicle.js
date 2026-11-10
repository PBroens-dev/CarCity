import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export class Vehicle {
    constructor(scene, physicsWorld, spawnPos) {
        this.scene = scene;
        this.physicsWorld = physicsWorld;
        this.wheelMeshes = [];
        this.initVehicle(spawnPos);
    }

    initVehicle(spawnPos) {
        // 1. Physics Chassis
        const chassisShape = new CANNON.Box(new CANNON.Vec3(1.05, 0.5, 2.3));
        this.chassisBody = new CANNON.Body({ mass: 1400 });
        this.chassisBody.addShape(chassisShape, new CANNON.Vec3(0, 0.2, 0));
        this.chassisBody.position.copy(spawnPos);
        this.chassisBody.angularDamping = 0.4;

        // 2. Visual Car Body (Realistic Metallic Paint + Glass Cabin)
        this.chassisMesh = new THREE.Group();

        const paintMat = new THREE.MeshPhysicalMaterial({
            color: 0xc0392b,
            metalness: 0.65,
            roughness: 0.2,
            clearcoat: 1.0,
            clearcoatRoughness: 0.1
        });

        const glassMat = new THREE.MeshPhysicalMaterial({
            color: 0x111111,
            metalness: 0.9,
            roughness: 0.05,
            transparent: true,
            opacity: 0.85
        });

        // Lower body
        const baseMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.75, 4.6), paintMat);
        baseMesh.position.y = 0.05;
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        this.chassisMesh.add(baseMesh);

        // Upper cabin
        const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.65, 2.3), glassMat);
        cabinMesh.position.set(0, 0.7, -0.2);
        cabinMesh.castShadow = true;
        this.chassisMesh.add(cabinMesh);

        // Headlights
        const headLightMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 3 });
        const hlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.2, 0.1), headLightMat);
        hlLeft.position.set(-0.7, 0.1, 2.3);
        const hlRight = hlLeft.clone();
        hlRight.position.x = 0.7;
        this.chassisMesh.add(hlLeft, hlRight);

        // Taillights
        this.tailLightMat = new THREE.MeshStandardMaterial({ color: 0x880000, emissive: 0xff0000, emissiveIntensity: 1 });
        const tlLeft = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.2, 0.1), this.tailLightMat);
        tlLeft.position.set(-0.7, 0.15, -2.3);
        const tlRight = tlLeft.clone();
        tlRight.position.x = 0.7;
        this.chassisMesh.add(tlLeft, tlRight);

        this.scene.add(this.chassisMesh);

        // 3. Raycast Vehicle Setup
        this.vehicle = new CANNON.RaycastVehicle({
            chassisBody: this.chassisBody,
            indexRightAxis: 0,
            indexUpAxis: 1,
            indexForwardAxis: 2
        });

        const wheelOptions = {
            radius: 0.42,
            directionLocal: new CANNON.Vec3(0, -1, 0),
            suspensionStiffness: 38,
            suspensionRestLength: 0.35,
            frictionSlip: 2.2,
            dampingRelaxation: 2.3,
            dampingCompression: 4.4,
            maxSuspensionForce: 100000,
            rollInfluence: 0.05,
            axleLocal: new CANNON.Vec3(-1, 0, 0),
            chassisConnectionPointLocal: new CANNON.Vec3(1, 1, 0),
            maxSuspensionTravel: 0.25,
            customSlidingRotationalSpeed: -30,
            useCustomSlidingRotationalSpeed: true
        };

        // Front Left, Front Right, Back Left, Back Right
        const wheelPositions = [
            new CANNON.Vec3(0.95, -0.1, 1.45),
            new CANNON.Vec3(-0.95, -0.1, 1.45),
            new CANNON.Vec3(0.95, -0.1, -1.45),
            new CANNON.Vec3(-0.95, -0.1, -1.45)
        ];

        wheelPositions.forEach(pos => {
            wheelOptions.chassisConnectionPointLocal.copy(pos);
            this.vehicle.addWheel(wheelOptions);
        });

        this.vehicle.addToWorld(this.physicsWorld);

        // 4. Visual Wheels
        const tireGeo = new THREE.CylinderGeometry(0.42, 0.42, 0.32, 24);
        tireGeo.rotateZ(Math.PI / 2);
        const tireMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.9 });
        const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.34, 16);
        rimGeo.rotateZ(Math.PI / 2);
        const rimMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8, roughness: 0.2 });

        for (let i = 0; i < 4; i++) {
            const wheelGroup = new THREE.Group();
            const tire = new THREE.Mesh(tireGeo, tireMat);
            const rim = new THREE.Mesh(rimGeo, rimMat);
            tire.castShadow = true;
            wheelGroup.add(tire, rim);
            this.scene.add(wheelGroup);
            this.wheelMeshes.push(wheelGroup);
        }
    }

    resetControls() {
        for (let i = 0; i < 4; i++) {
            this.vehicle.applyEngineForce(0, i);
            this.vehicle.setBrake(25, i);
        }
        this.tailLightMat.emissiveIntensity = 0.5;
    }

    update(dt, keys) {
        if (keys) {
            const maxForce = 3800;
            const maxSteerVal = 0.55;
            const brakeForce = 65;

            let engineForce = 0;
            if (keys.w) engineForce = -maxForce;
            if (keys.s) engineForce = maxForce * 0.7;

            let steer = 0;
            if (keys.a) steer = -maxSteerVal;
            if (keys.d) steer = maxSteerVal;

            // Apply Rear-Wheel Drive & Front Steering
            this.vehicle.applyEngineForce(engineForce, 2);
            this.vehicle.applyEngineForce(engineForce, 3);
            this.vehicle.setSteeringValue(steer, 0);
            this.vehicle.setSteeringValue(steer, 1);

            // Braking & Taillight Glow
            if (keys.space) {
                this.vehicle.setBrake(brakeForce, 2);
                this.vehicle.setBrake(brakeForce, 3);
                this.tailLightMat.emissiveIntensity = 4.0;
            } else {
                for (let i = 0; i < 4; i++) this.vehicle.setBrake(0, i);
                this.tailLightMat.emissiveIntensity = keys.s ? 3.5 : 0.8;
            }
        }

        // Sync Chassis Visuals
        this.chassisMesh.position.copy(this.chassisBody.position);
        this.chassisMesh.quaternion.copy(this.chassisBody.quaternion);

        // Sync Wheels Visuals
        for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
            this.vehicle.updateWheelTransform(i);
            const t = this.vehicle.wheelInfos[i].worldTransform;
            this.wheelMeshes[i].position.copy(t.position);
            this.wheelMeshes[i].quaternion.copy(t.quaternion);
        }
    }
}
