import * as THREE from 'three'
// import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls' // mouse control camera
import * as CANNON from 'cannon-es'
import CannonDebugRenderer from 'cannon-es-debugger/dist/cannon-es-debugger'
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
// import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as dat from 'dat.gui'
import Stats from 'three/examples/jsm/libs/stats.module'
import TWEEN from '@tweenjs/tween.js'
// import { FirstPersonControls } from 'three/examples/jsm/controls/FirstPersonControls'
// import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

let camera, scene, renderer, controls
let terrainMeth
let world
let groundBody
let heightData = null
const terrainWidth = 200
const terrainDepth = 200
const widthSegments = 200
const depthSegments = 200
const terrainMaxHeight = 8
const terrainMinHeight = -2
 
const size = widthSegments * depthSegments
heightData = new Float32Array(size)
const hRange = terrainMaxHeight - terrainMinHeight
const w2 = widthSegments / 2
const d2 = depthSegments / 2

const phaseMult = 12
let p = 0
for (let j = 0; j < depthSegments; j++) {
  for (let i = 0; i < widthSegments; i++) {
    const radius = Math.sqrt(
      Math.pow((i - w2) / w2, 2.0) + Math.pow((j - d2) / w2, 2.0)
    )
    const height = (Math.sin(radius * phaseMult) + 1) * 0.5 * hRange + terrainMinHeight
    heightData[p] = height
    p++
  }
}
//Cannon world
world = new CANNON.World()
world.gravity.set(0, -9.82, 0) // set G

//renderer
renderer = new THREE.WebGLRenderer();
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true
document.body.appendChild(renderer.domElement);

//camera
camera = new THREE.PerspectiveCamera(30, window.innerWidth / window.innerHeight, 0.2, 2000);
camera.position.set(1, 60, 100)
camera.lookAt(0, 0, 0)

//scene
scene = new THREE.Scene()
scene.background = new THREE.Color(0xbfd1e5)
scene.add(new THREE.AxesHelper(50))

const cannonRenderer = new CannonDebugRenderer(scene, world);

//gui
const gui = new dat.GUI()
//stat
const stat = new Stats()
document.body.append(stat.dom)
//texture
const textureLoader = new THREE.TextureLoader()
//light
const light = new THREE.DirectionalLight(0xffffff)
light.position.set(100, 100, 50)
light.castShadow = true
const dLight = 200
const sLight = dLight * 0.25
light.shadow.camera.left = -sLight
light.shadow.camera.right = sLight
light.shadow.camera.top = sLight
light.shadow.camera.bottom = -sLight
light.shadow.camera.near = dLight / 30
light.shadow.camera.far = dLight
light.shadow.mapSize.x = 1024 * 2
light.shadow.mapSize.y = 1024 * 2

//ambient
const ambientLight = new THREE.AmbientLight(0xffffff, 0.8)
scene.add(ambientLight)
scene.add(light)

//event
window.addEventListener('resize', onWindowResize)

function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  renderer.setSize(window.innerWidth, window.innerHeight)
}

//mesh
const geometry = new THREE.PlaneGeometry(terrainWidth, terrainDepth, widthSegments - 1, depthSegments - 1)
geometry.rotateX(- Math.PI / 2)

const vertices = geometry.attributes.position.array
for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
  vertices[j + 1] = heightData[i]
}

geometry.computeVertexNormals()

const groundTexture = textureLoader.load("./tire.png")
const material = new THREE.MeshPhongMaterial({ color: 0xC7C7C7 })
terrainMeth = new THREE.Mesh(geometry, material)
terrainMeth.receiveShadow = true
terrainMeth.castShadow = true

scene.add(terrainMeth)

const obj = { bool: false }
gui.add(obj, 'bool').onChange(function (e) {
  if (e) {
    material.map = groundTexture;
  } else {
    material.map = null;
  }
  material.needsUpdate = true; //update material
}).name("Ground Texture: ")

//cannon 
const matrix = []; // height data
for (let i = 0; i < widthSegments; i++) {
  matrix.push([]);
  for (let j = 0; j < depthSegments; j++) {
    const heightValue = heightData[i * depthSegments + j]; // get height
    matrix[i].push(heightValue);
  }
}
const terrainShape = new CANNON.Heightfield(matrix, {
  elementSize: terrainWidth / (widthSegments - 1),
});

groundBody = new CANNON.Body({
  mass: 0,
  quaternion: new CANNON.Quaternion().setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
});
groundBody.addShape(terrainShape);
groundBody.position.set(-terrainWidth / 2, 0, terrainDepth / 2); // position
world.addBody(groundBody);

// 458 model
const dracoLoader = new DRACOLoader()
dracoLoader.setDecoderPath('jsm/libs/draco/gltf/')
const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

let model
let wheels = []
await loader.loadAsync('models/gltf/ferrari.glb').then((gltf) => {
  model = gltf.scene
  model.scale.set(5, 5, 5)
  model.position.set(-10, 15, -15)

  wheels.push(
    model.getObjectByName('wheel_fl'),
    model.getObjectByName('wheel_fr'),
    model.getObjectByName('wheel_rl'),
    model.getObjectByName('wheel_rr')
  );
  scene.add(model)

  const carColors = { color: 0xff0000 }
  let carBC = model.getObjectByName("body")

  gui.addColor(carColors, 'color').onChange((val) => {
    carBC.traverse((child) => { if (child.isMesh) child.material.color.set(val) }) 
  }).name("Car Color: ")
})
//Robot model
let robotModel, mixer, gltfM
// await loader.loadAsync('models/gltf/Soldier.glb').then((gltf) => {
  await loader.loadAsync('./boxman.glb').then((gltf) => {
  gltfM = gltf 
  robotModel = gltf.scene;
  console.log(gltfM.animations);
  mixer = new THREE.AnimationMixer(robotModel);

  let skeleton = new THREE.SkeletonHelper(robotModel);
  skeleton.visible = false;
  scene.add(skeleton);

  robotModel.scale.set(5, 5, 5)
  robotModel.position.set(-10, 15, -15)
  robotModel.rotation.y = Math.PI

  scene.add(robotModel)

  const robotColors = { color: 0xffffff }

  gui.addColor(robotColors, 'color').onChange((val) => {
    robotModel.traverse((child) => {
      if (child.isMesh) {
        child.material.color.set(val)
      }
    })
  }).name("Robot Color: ")
});
const robotBody = new CANNON.Body({
  mass: 3,
  position: new CANNON.Vec3(37, 5, -15),
  shape: new CANNON.Box(new CANNON.Vec3(1, 0.1, 2)),
})
world.addBody(robotBody)

const robotLF = new CANNON.Body({
  mass: 1,
  position: new CANNON.Vec3(37, 3, -15),
  shape: new CANNON.Sphere(1),
})
world.addBody(robotLF)
const robotRF = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Sphere(1),
  position: new CANNON.Vec3(40, 3, -15),
})
world.addBody(robotRF)
const robotLB = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Sphere(1),
  position: new CANNON.Vec3(37, 3, -13),
})
world.addBody(robotLB)
const robotRB = new CANNON.Body({
  mass: 1,
  shape: new CANNON.Sphere(1),
  position: new CANNON.Vec3(40, 3, -13),
})
world.addBody(robotRB)

// character
const test1 = new CANNON.Body({
  mass: 5,
  position: new CANNON.Vec3(-37, 10, 65),
  shape: new CANNON.Box(new CANNON.Vec3(2, 0.5, 2)),
})
world.addBody(test1)

//car
const carBody = new CANNON.Body({
  mass: 3,
  shape: new CANNON.Box(new CANNON.Vec3(1, 0, 1)),
  position: new CANNON.Vec3(0, 15, 4)
})
world.addBody(carBody)

//wheel
const wheelLFBody = new CANNON.Body({
  mass: 1,
  material: new CANNON.Material(),
  shape: new CANNON.Sphere(2),
  position: new CANNON.Vec3(-10, 10, 0)
})
world.addBody(wheelLFBody)
const wheelRFBody = new CANNON.Body({
  mass: 1,
  material: new CANNON.Material(),
  shape: new CANNON.Sphere(2),
  position: new CANNON.Vec3(10, 10, -5)
})
world.addBody(wheelRFBody)
const wheelLBBody = new CANNON.Body({
  mass: 1,
  material: new CANNON.Material(),
  shape: new CANNON.Sphere(2),
  position: new CANNON.Vec3(-10, 10, 5)
})
world.addBody(wheelLBBody)
const wheelRBBody = new CANNON.Body({
  mass: 1,
  material: new CANNON.Material(),
  shape: new CANNON.Sphere(2),
  position: new CANNON.Vec3(10, 10, 5)
})
world.addBody(wheelRBBody)
//constraint
const lFAxis = new CANNON.Vec3(1, 0, 0)
const rFrontAxis = new CANNON.Vec3(1, 0, 0)
const lBAxis = new CANNON.Vec3(1, 0, 0)
const rBAxis = new CANNON.Vec3(1, 0, 0)
const constraintLF = new CANNON.HingeConstraint(carBody, wheelLFBody, {
  pivotA: new CANNON.Vec3(-5, 2, -5.5),
  axisA: lFAxis,
  maxForce: 0.99,
})
world.addConstraint(constraintLF)

const constraintRF = new CANNON.HingeConstraint(carBody, wheelRFBody, {
  pivotA: new CANNON.Vec3(5, 2, -5.5),
  axisA: rFrontAxis,
  maxForce: 0.99,
})
world.addConstraint(constraintRF)
const constraintLB = new CANNON.HingeConstraint(carBody, wheelLBBody, {
  pivotA: new CANNON.Vec3(-5, 2, 7),
  axisA: lBAxis,
  maxForce: 0.99,
})
world.addConstraint(constraintLB)
const constraintRB = new CANNON.HingeConstraint(carBody, wheelRBBody, {
  pivotA: new CANNON.Vec3(5, 2, 7),
  axisA: rBAxis,
  maxForce: 0.99,
})
world.addConstraint(constraintRB)

//robot
const constraintRLF = new CANNON.HingeConstraint(robotBody, robotLF, {
  pivotA: new CANNON.Vec3(-3, -0.5, -4),
  axisA: lFAxis,
  maxForce: 0.99,
})
world.addConstraint(constraintRLF)
const constraintRRF = new CANNON.HingeConstraint(robotBody, robotRF, {
  pivotA: new CANNON.Vec3(3, -0.5, -4),
  axisA: lFAxis,
  maxForce: 0.99,
})
world.addConstraint(constraintRRF)
const constraintRLB = new CANNON.HingeConstraint(robotBody, robotLB, {
  pivotA: new CANNON.Vec3(-3, -0.5, 4),
  axisA: lFAxis,
  maxForce: 0.99,
})
world.addConstraint(constraintRLB)
const constraintRRB = new CANNON.HingeConstraint(robotBody, robotRB, {
  pivotA: new CANNON.Vec3(3, -0.5, 4),
  axisA: lFAxis,
  maxForce: 0.99,
})
world.addConstraint(constraintRRB)

//rear wheel drive
constraintLB.enableMotor()
constraintRB.enableMotor()
constraintRLB.enableMotor()
constraintRRB.enableMotor()

//add button Listener
// keydown
document.addEventListener('keydown', (event) => { console.log('KEY DOWN:', event.code); })
// keyup
document.addEventListener('keyup', (event) => { console.log('KEY UP:', event.code); })
const keyStates = {
  W: false,
  A: false,
  S: false,
  D: false,
  ArrowUp: false,
  ArrowDown: false,
  ArrowLeft: false,
  ArrowRight: false,
  Space: false,
};
//robot action
let RunAction = mixer.clipAction(gltfM.animations[25])
let WalkAction = mixer.clipAction(gltfM.animations[19])
let IdleAction = mixer.clipAction(gltfM.animations[11])
let JumpAction = mixer.clipAction(gltfM.animations[13])
JumpAction.loop = THREE.LoopOnce
JumpAction.clampWhenFinished = true
IdleAction.play();
RunAction.play();
WalkAction.play();
JumpAction.play()
IdleAction.weight = 1.0;
RunAction.weight = 0.0;
WalkAction.weight = 0.0;
JumpAction.weight = 0.0
// keydown is true
document.addEventListener('keydown', (event) => {
  if (event.code === 'KeyW') keyStates.W = true;
  if (event.code === 'KeyA') keyStates.A = true;
  if (event.code === 'KeyS') keyStates.S = true;
  if (event.code === 'KeyD') keyStates.D = true;
  if (event.code === 'ArrowUp') {
    keyStates.ArrowUp = true;

    const tweenStop = new TWEEN.Tween(IdleAction);
    tweenStop.to({weight:0.0}, 500);
    tweenStop.start(); 

    const tween = new TWEEN.Tween(WalkAction);
    tween.to({weight:1.0}, 500);
    tween.start(); 
  }
  if (event.code === 'ArrowDown') keyStates.ArrowDown = true
  if (event.code === 'ArrowLeft') keyStates.ArrowLeft = true;
  if (event.code === 'ArrowRight') keyStates.ArrowRight = true;
  if (event.code === 'Space') {
    keyStates.Space = true;
    
    RunAction.weight = 0.0;
    WalkAction.weight = 0.0;

    const tween = new TWEEN.Tween(JumpAction);
    tween.to({weight:1.0}, 500);
    tween.start(); 
  }

  if (event.code === 'ShiftLeft') {
    keyStates.ShiftLeft = true;
    
    if (keyStates.ArrowUp) {  
      const tween = new TWEEN.Tween(RunAction);
      tween.to({weight:3.0}, 500);
      tween.start(); 
    }
  }
  if (event.code === 'ShiftRight') {
    keyStates.ShiftRight = true;

    if (keyStates.ArrowUp) {  
      const tween = new TWEEN.Tween(RunAction);
      tween.to({weight:3.0}, 500);
      tween.start(); 
    } 
  }
});
// keyup is false
document.addEventListener('keyup', (event) => {
  if (event.code === 'KeyW') keyStates.W = false;
  if (event.code === 'KeyA') keyStates.A = false;
  if (event.code === 'KeyS') keyStates.S = false;
  if (event.code === 'KeyD') keyStates.D = false;
  if (event.code === 'ArrowUp') {
    keyStates.ArrowUp = false;
    
    const tween = new TWEEN.Tween(IdleAction);
    tween.to({weight:1.0}, 500);
    tween.start(); 

    const tweenStop = new TWEEN.Tween(WalkAction);
    tweenStop.to({weight:0.0}, 500);
    tweenStop.start(); 

    const tweenStop2 = new TWEEN.Tween(RunAction);
    tweenStop2.to({weight:0.0}, 500);
    tweenStop2.start(); 
  }
  if (event.code === 'ArrowDown') keyStates.ArrowDown = false
  if (event.code === 'ArrowLeft') keyStates.ArrowLeft = false;
  if (event.code === 'ArrowRight') keyStates.ArrowRight = false;
  if (event.code === 'Space') {
    // keyStates.Space = false;
    const tween = new TWEEN.Tween(JumpAction);
    tween.to({weight:0.0}, 500);
    tween.start(); 
  }
  if (event.code === 'ShiftLeft') {
    keyStates.ShiftLeft = false;

    const tweenStop = new TWEEN.Tween(RunAction);
    tweenStop.to({weight:0.0}, 500);
    tweenStop.start();

    // if (keyStates.ArrowUp) {
      const tween = new TWEEN.Tween(WalkAction);
      tween.to({weight:1.0}, 500);
      tween.start(); 
    // }
  }
  if (event.code === 'ShiftRight') {
    keyStates.ShiftRight = false;

    const tweenStop = new TWEEN.Tween(RunAction);
    tweenStop.to({weight:0.0}, 500);
    tweenStop.start();
  }
});

let leftBtn = false;//left
robotModel.add(camera);
camera.position.set(0, 2, -4);
camera.lookAt(robotModel.position)

document.addEventListener('mousedown', () => { leftBtn = true; });
document.addEventListener('mouseup', () => { leftBtn = false; });
document.addEventListener('mousemove', (event) => {
  robotModel.rotation.y -= event.movementX / 200;
	camera.rotation.x += event.movementY / 600;
  if (leftBtn) {// left & right rotation
    robotModel.rotation.y -= event.movementX / 600;
    camera.rotation.x += event.movementY / 600;
  }
});

let forwardVelocity = 0
let rightVelocity = 0
let forwardV = 0
let rightV = 0
const clock = new THREE.Clock()
let thrusting = false
let thrustingR = false

function animate() {
  requestAnimationFrame(animate)
  const deltaTime = clock.getDelta();

  world.step(deltaTime)
  if (mixer) mixer.update(deltaTime)

  robotModel.position.copy(test1.position)

  model.position.copy(carBody.position)
  model.quaternion.copy(carBody.quaternion)
  wheels[0].quaternion.copy(wheelLFBody.quaternion)
  wheels[1].quaternion.copy(wheelRFBody.quaternion)
  wheels[2].quaternion.copy(wheelLBBody.quaternion)
  wheels[3].quaternion.copy(wheelRBBody.quaternion)

  thrusting = false
  if (keyStates.W) {
    if (forwardVelocity < 10.0) forwardVelocity += 1
    thrusting = true
  }
  if (keyStates.S) {
    if (forwardVelocity > -10.0) forwardVelocity -= 1
    thrusting = true
  }
  if (keyStates.A) {
    if (rightVelocity > -1.0) rightVelocity -= 0.1
  }
  if (keyStates.D) {
    if (rightVelocity < 1.0) rightVelocity += 0.1
  }
  if (!thrusting) {   //slow down
    if (forwardVelocity > 0) forwardVelocity -= 2
    if (forwardVelocity < 0) forwardVelocity += 2
  }

  constraintLB.setMotorSpeed(forwardVelocity)
  constraintRB.setMotorSpeed(forwardVelocity)
  constraintLF.axisA.z = rightVelocity
  constraintRF.axisA.z = rightVelocity

  const moveF = new THREE.Vector3()
  const cameraDir = camera.getWorldDirection(moveF).normalize()

  thrustingR = false
  if (keyStates.Space) {
    if (test1.position.y <= 9 && test1.velocity.y <= 5) test1.velocity.y += 9;
    
}
  if (keyStates.ArrowUp) {
    if (forwardV < 10.0) forwardV += 0.5
    thrustingR = true
    if (!keyStates.Space) WalkAction.weight = 1.0;
    
    test1.position.z += cameraDir.z * 0.1
    test1.position.x += cameraDir.x * 0.1
    
    if (keyStates.ShiftLeft || keyStates.ShiftRight) {
      test1.position.z += cameraDir.z * 0.2
      test1.position.x += cameraDir.x * 0.2
    }
    if (keyStates.Space) {
      if (test1.position.y <= 9 && test1.velocity.y <= 5) test1.velocity.y += 5;
      // keyStates.ArrowUp = false
  }
}
  if (keyStates.ArrowDown) {
    thrustingR = true
    if (forwardV > -10.0) forwardV -= 0.5
    IdleAction.weight = 0.0;
    RunAction.weight = 0.0;
    WalkAction.weight = 1.0;
    JumpAction.weight = 0.0
    test1.position.z -= cameraDir.z * 0.1
    test1.position.x -= cameraDir.x * 0.1
  }
  if (keyStates.ArrowDown && keyStates.ShiftLeft || keyStates.ArrowDown && keyStates.ShiftRight) {
    thrustingR = true
    if (forwardV > -15.0) forwardV -= 1
    IdleAction.weight = 0.0;
    RunAction.weight = 1.0;
    WalkAction.weight = 0.0;
    JumpAction.weight = 0.0;

    test1.position.z -= cameraDir.z * 0.2;
    test1.position.x -= cameraDir.x * 0.2;
  }
  if (keyStates.ArrowLeft) {
    if (rightV > -1.0) rightV -= 0.1;
    IdleAction.weight = 0.0;
    RunAction.weight = 0.0;
    WalkAction.weight = 1.0;
    JumpAction.weight = 0.0;
    
    const front = new THREE.Vector3();
    robotModel.getWorldDirection(front);
    const up = new THREE.Vector3(0, 1, 0); //y direction
    const left = up.clone().cross(front);
    test1.position.z -= left.multiplyScalar(0.2).z
    test1.position.x -= left.multiplyScalar(0.2).x;
  }
  if (keyStates.ArrowLeft && keyStates.ShiftLeft || keyStates.ArrowLeft && keyStates.ShiftRight) {
    if (rightV > -1.0) rightV -= 0.1;
    IdleAction.weight = 0.0;
    RunAction.weight = 1.0;
    WalkAction.weight = 0.0;
    JumpAction.weight = 0.0;

    const front = new THREE.Vector3();
    robotModel.getWorldDirection(front);
    const up = new THREE.Vector3(0, 1, 0); //y direction
    const left = up.clone().cross(front);
    test1.position.z -= left.multiplyScalar(0.4).z
    test1.position.x -= left.multiplyScalar(0.4).x;
  }
  if (keyStates.ArrowRight) {
    if (rightV < 1.0) rightV += 0.1;
    if (rightV < 10.0) rightV += 1.0;

    IdleAction.weight = 0.0;
    RunAction.weight = 0.0;
    WalkAction.weight = 1.0;
    JumpAction.weight = 0.0;

    const front = new THREE.Vector3();
    robotModel.getWorldDirection(front);
    const up = new THREE.Vector3(0, 1, 0); //y direction
    const left = up.clone().cross(front);
    test1.position.z += left.multiplyScalar(0.2).z
    test1.position.x += left.multiplyScalar(0.2).x;
  }
  if (keyStates.ArrowRight && keyStates.ShiftLeft || keyStates.ArrowRight && keyStates.ShiftRight) {
    if (rightV < 1.0) rightV += 0.1
    IdleAction.weight = 0.0;
    RunAction.weight = 1.0;
    WalkAction.weight = 0.0;
    JumpAction.weight = 0.0;

    const front = new THREE.Vector3();
    robotModel.getWorldDirection(front);
    const up = new THREE.Vector3(0, 1, 0);//y direction
    const left = up.clone().cross(front);
    test1.position.z += left.multiplyScalar(0.4).z
    test1.position.x += left.multiplyScalar(0.4).x;
  }
  if (!keyStates.ArrowDown && !keyStates.ArrowUp && !keyStates.ArrowLeft && !keyStates.ArrowRight && !keyStates.Space) {
    IdleAction.weight = 1.0;
    RunAction.weight = 0.0;
    WalkAction.weight = 0.0;
    JumpAction.weight = 0.0
  }
  if (!thrustingR) { //slow down
    if (forwardV > 0) forwardV -= 2
    if (forwardV < 0) forwardV += 2
  }

  constraintRLB.setMotorSpeed(forwardV)
  constraintRRB.setMotorSpeed(forwardV)
  constraintRLF.axisA.z = rightV
  constraintRRF.axisA.z = rightV

  cannonRenderer.update()

  stat.update()
  TWEEN.update()
  renderer.render(scene, camera)
}
animate()