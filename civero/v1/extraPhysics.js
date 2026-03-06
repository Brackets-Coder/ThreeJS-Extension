// Name: Extra 3D Physics
// ID: threejsPhysicsExtension
// Description: Extension for extra3D, using RAPIER physics
// By: Civero <https://scratch.mit.edu/users/civero/> <https://civero.itch.io> <https://civ3ro.github.io/extensions>
// License: MIT License Copyright (c) 2021-2024 TurboWarp Extensions Contributors

(function (Scratch) {

  if (!Scratch.extensions.unsandboxed) {throw new Error("Extension must run unsandboxed")}
  if (!Scratch.vm.extensionManager._loadedExtensions.has("threejsExtension")) throw new Error("Load Extra 3D first! This extension adds Physics, this is not the main one.")

  console.log('Loading RAPIER for Extra3D')
  const vm = Scratch.vm

  const THREE = _Extra3D_.THREE

  let RAPIER
  let physicsWorld

  async function load() {

    RAPIER = await import("https://esm.sh/@dimforge/rapier3d-compat@0.19.0")
    await RAPIER.init()

    _Extra3D_.RAPIER = RAPIER
    Object.defineProperties(_Extra3D_, {
      PhysicsWorld: { get: () => physicsWorld, enumerable: true, configurable: true }
    })

    _Extra3D_.onUpdate.push((delta) => { //loop

      if (physicsWorld && _Extra3D_.SCENE) {
        physicsWorld.step()

        _Extra3D_.SCENE.children.forEach(obj => {
          if (!(obj.isMesh) || !(obj.physics)) return
          if (obj.rigidBody) {
            obj.position.copy(obj.rigidBody.translation())
            obj.quaternion.copy(obj.rigidBody.rotation())
          }
        })
      }

    })
  }

  Promise.resolve(load()).then(()=>{

    console.log("RAPIER Packages Loaded")

    function computeWorldBoundingBox(mesh) {
        // Create a Box3 in world coordinates
        const box = new THREE.Box3().setFromObject(mesh);
        const size = new THREE.Vector3();
        box.getSize(size);
        const center = new THREE.Vector3();
        box.getCenter(center);
        return { size, center };
    }
    function createCuboidCollider(mesh) {
        const { size } = computeWorldBoundingBox(mesh);
        const collider = RAPIER.ColliderDesc.cuboid(
            size.x / 2,
            size.y / 2,
            size.z / 2
        )
        return collider;
    }
    function createBallCollider(mesh) {
        const { size } = computeWorldBoundingBox(mesh);
        // radius = 1/2 of the largest verticie
        const radius = Math.max(size.x, size.y, size.z) / 2;
        const collider = RAPIER.ColliderDesc.ball(radius)
        return collider //there's a flaw with this, if the ball is deformed in just one axis it will be inaccurate. use convex instead (?)
    }
    function createConvexHullCollider(mesh) {
        mesh.updateWorldMatrix(true, false);

        const position = mesh.geometry.attributes.position;
        const vertices = [];
        const vertex = new THREE.Vector3();

        // Matrix for scale only
        const scaleMatrix = new THREE.Matrix4().makeScale(
            mesh.scale.x,
            mesh.scale.y,
            mesh.scale.z
        );

        for (let i = 0; i < position.count; i++) {
            vertex.fromBufferAttribute(position, i).applyMatrix4(scaleMatrix);
            vertices.push(vertex.x, vertex.y, vertex.z);
        }

        const collider = RAPIER.ColliderDesc.convexHull(Float32Array.from(vertices));
        return collider;
    }
    function TriMesh(mesh) {
    // Get the positions array (from your geoPoints function)
    const positions = mesh.geometry.attributes.position.array; 
    const numVertices = positions.length / 3;

    // Create an index array: [0, 1, 2, 3, 4, 5, ..., numVertices - 1]
    const indices = Array.from({ length: numVertices }, (_, i) => i);

    const collider = RAPIER.ColliderDesc.trimesh(
        positions, 
        new Uint32Array(indices) 
    );

    return collider
    }

    class RapierPhysics {
    getInfo() {
    return {
        id: "rapierPhysics",
        name: "RAPIER Physics",
        color1: "#849b57ff",
        color2: "#6e8541ff",
        color3: "#647a38ff",
        blocks: [
        {opcode: "initWorld", blockType: Scratch.BlockType.COMMAND, text: "restart physics world"},
        {opcode: "setGravity", blockType: Scratch.BlockType.COMMAND, text: "set world gravity: [G]", arguments: {G: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,-9.81,0]"}}},
        {opcode: "getWorld", blockType: Scratch.BlockType.REPORTER, text: "get world [PROPERTY]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "wProp"}}},
        "---",
        {opcode: "objectPhysics", blockType: Scratch.BlockType.COMMAND, text: "enable physics for object [OBJECT] [state] | rigidBody [type] | collider [collider] mass [mass] density [density] friction [friction] sensor [state2]", arguments: {state2: {type: Scratch.ArgumentType.STRING, menu: "state2"},state: {type: Scratch.ArgumentType.STRING, menu: "state", defaultValue: "true"}, type: {type: Scratch.ArgumentType.STRING, menu: "objectTypes", defaultValue: "dynamic"}, collider: {type: Scratch.ArgumentType.STRING, menu: "colliderTypes", defaultValue: "cuboid"}, OBJECT: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"},mass: {type: Scratch.ArgumentType.NUMBER, defaultValue: "1"},density: {type: Scratch.ArgumentType.NUMBER, defaultValue: "1"},friction: {type: Scratch.ArgumentType.NUMBER, defaultValue: "0.5"}}},
        "---",
        {blockType: Scratch.BlockType.LABEL, text: "- RigidBody"},
        {opcode: "setRB", blockType: Scratch.BlockType.COMMAND, text: "set rigidbody [PROPERTY] of [OBJECT] to [VALUE]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "rigidBodySets"}, OBJECT: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}, VALUE: {type: Scratch.ArgumentType.STRING, defaultValue: "1"}}},
        {opcode: "getRB", blockType: Scratch.BlockType.REPORTER, text: "get rigidbody [PROPERTY] of [OBJECT]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "rigidBodyProperties"}, OBJECT: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},
        "---",
        {opcode: "lockObjectAxis", blockType: Scratch.BlockType.COMMAND, text: "lock rigidbody [OBJECT] [PROPERTY] on x:[X] y:[Y] z:[Z]", arguments: {OBJECT: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}, PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "lockAxes"}, X: {type: Scratch.ArgumentType.STRING, menu: "tf"}, Y: {type: Scratch.ArgumentType.STRING, menu: "tf"}, Z: {type: Scratch.ArgumentType.STRING, menu: "tf"}}},
        "---",
        {opcode: "addForce", blockType: Scratch.BlockType.COMMAND, text: "set [PROPERTY] of [OBJECT] to [VALUE] in [SPACE] space", arguments: {VALUE: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,10,0]"},PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "forces", defaultValue: "addForce"},SPACE: {type: Scratch.ArgumentType.STRING, menu: "spaces", defaultValue: "world"}, OBJECT: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},
        {opcode: "resetForces", blockType: Scratch.BlockType.COMMAND, text: "reset [PROPERTY] of [OBJECT]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "resetF", defaultValue: "resetForces"}, OBJECT: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},
        "---",
        {opcode: "enableCCD", blockType: Scratch.BlockType.COMMAND, text: "enable Continuous Collision Detection for [OBJECT] [state]", arguments: {state: {type: Scratch.ArgumentType.STRING, menu: "state", defaultValue: "true"},PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "oPropS", defaultValue: "physics"}, OBJECT: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},
        "---",
        {opcode: "fixedJoint", blockType: Scratch.BlockType.COMMAND, text: "create FIXED joint between [ObjA] & [ObjB] | anchor A: [VA] [RA] B: [VB] [RB]", arguments: {ObjA: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"},ObjB: {type: Scratch.ArgumentType.STRING, defaultValue: "myObjectB"},VA: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"},VB: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,1,0]"},RA: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"},RB: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"},}},
        {opcode: "sphericalJoint", blockType: Scratch.BlockType.COMMAND, text: "create SPHERICAL joint between [ObjA] & [ObjB] | anchor A: [VA] B: [VB]", arguments: {ObjA: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"},ObjB: {type: Scratch.ArgumentType.STRING, defaultValue: "myObjectB"},VA: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"},VB: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,1,0]"},}},
        {opcode: "revoluteJoint", blockType: Scratch.BlockType.COMMAND, text: "create REVOLUTE joint between [ObjA] & [ObjB] | anchor A: [VA] B: [VB] | axis: [X]", arguments: {ObjA: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"},ObjB: {type: Scratch.ArgumentType.STRING, defaultValue: "myObjectB"},VA: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"},VB: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,1,0]"},X: {type: Scratch.ArgumentType.STRING, defaultValue: "[1,0,0]"},}},
        "---",
        {blockType: Scratch.BlockType.LABEL, text: "- Collider"},
        {opcode: "setC", blockType: Scratch.BlockType.COMMAND, text: "set collider [PROPERTY] of [OBJECT] to [VALUE]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "colliderSets"}, OBJECT: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}, VALUE: {type: Scratch.ArgumentType.STRING, defaultValue: "1"}}},
        {opcode: "getC", blockType: Scratch.BlockType.REPORTER, text: "get collider [PROPERTY] of [OBJECT]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "colliderProperties"}, OBJECT: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},
        "---",
        {opcode: "sensorSingle", blockType: Scratch.BlockType.BOOLEAN, text: "is sensor [SENSOR] touching [OBJECT]?", arguments: {SENSOR: {type: Scratch.ArgumentType.STRING, defaultValue: "mySensor"}, OBJECT: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},
        {opcode: "sensorAll", blockType: Scratch.BlockType.REPORTER, text: "objects touching sensor [SENSOR]", arguments: {SENSOR: {type: Scratch.ArgumentType.STRING, defaultValue: "mySensor"}}}
        ],
        menus: {
        wProp: {acceptReporters: false, items: [
            {text: "Gravity", value: "gravity"}, {text: "log to console", value: "log"}
        ]},
        tf: {acceptReporters: true, items: [{text: "false", value: "false"},{text: "true", value: "true"}]},
        lockAxes: {acceptReporters: false, items: [
            {text: "Translation", value: "setEnabledTranslations"}, {text: "Rotation", value: "setEnabledRotations"}
        ]},
        rigidBodyProperties: {acceptReporters: false, items: [
            {text: "Type", value: "bodyType"},
            {text: "Linear Velocity", value: "linvel"},
            {text: "Angular Velocity", value: "angvel"},
            {text: "Translation (position)", value: "translation"},
            {text: "Rotation (quaternion)", value: "rotation"},
            {text: "Mass", value: "mass"},
            //{text: "Center of Mass", value: "centerOfMass"},
            {text: "Linear Damping", value: "linearDamping"},
            {text: "Angular Damping", value: "angularDamping"},
            {text: "Is Sleeping?", value: "isSleeping"},
            //{text: "Can Sleep?", value: "isCanSleep"},
            {text: "Gravity Scale", value: "gravityScale"},
            {text: "Is Fixed?", value: "isFixed"},
            {text: "Is Dynamic?", value: "isDynamic"},
            {text: "Is Kinematic?", value: "isKinematic"},
            //{text: "Sleeping", value: "sleeping"}
        ]},
        rigidBodySets: {acceptReporters: false, items: [
            //{text: "Linear Velocity", value: "setLinvel"},
            //{text: "Angular Velocity", value: "setAngvel"},
            //{text: "Mass", value: "setMass"},
            {text: "Gravity Scale", value: "setGravityScale"},
            //{text: "Can Sleep?", value: "setCanSleep"},
            //{text: "Sleeping", value: "sleeping"},
            {text: "Linear Damping", value: "setLinearDamping"},
            {text: "Angular Damping", value: "setAngularDamping"},
            {text: "Is Fixed?", value: "isFixed"},
            {text: "Is Dynamic?", value: "isDynamic"},
            {text: "Is Kinematic?", value: "isKinematic"}
        ]},
        colliderProperties: {acceptReporters: false, items: [
            //{text: "Collider Type", value: "type"},
            {text: "Is Sensor?", value: "isSensor"},
            {text: "Friction", value: "friction"},
            {text: "Restitution", value: "restitution"},
            {text: "Density", value: "density"},
            {text: "Mass", value: "mass"},
            {text: "Position", value: "translation"},
            {text: "Rotation", value: "rotation"},
            //{text: "Area", value: "area"},
            {text: "Volume", value: "volume"},
            {text: "Collision Groups", value: "collisionGroups"},
            //{text: "Collision Mask", value: "collisionMask"},
            //{text: "Is Enabled?", value: "enabled"},
            //{text: "Contact Count", value: "contactCount"},
            //{text: "RigidBody Handle", value: "rigidBody"}
        ]},
        colliderSets: {acceptReporters: false, items: [
            {text: "Friction", value: "setFriction"},
            {text: "Restitution", value: "setRestitution"},
            {text: "Density", value: "setDensity"},
            {text: "Is Sensor?", value: "setSensor"},
            {text: "Collision Groups", value: "setCollisionGroups"},
            //{text: "Enabled", value: "enabled"},                 // object.collider.enabled = bool
            //{text: "Position Offset", value: "setTranslation"},
            //{text: "Rotation Offset", value: "setRotation"}
        ]},
        state: {acceptReporters: true, items: [{text: "on", value: "true"},{text: "off", value: "false"}]},
        state2: {acceptReporters: true, items: [{text: "false", value: "false"},{text: "true (must be fixed)", value: "true"}]},
        spaces: {acceptReporters: false, items: [{text: "World", value: "world"},{text: "Local", value: "local"}]},
        objectTypes: {acceptReporters: false, items: [{text: "Dynamic", value: "dynamic"},{text: "Fixed", value: "fixed"},{text: "Kinematic Position Based",value: "kinematicPositionBased"}]},
        colliderTypes: {acceptReporters: false, items: [{text: "Box, Rectangle, cuboid", value: "cuboid"},{text: "Sphere, ball", value: "ball"},{text: "Custom, complex simple shapes, convexHull", value: "convexHull"},{text:"Precision, TriMesh",value:"trimesh"}]},
        forces: {acceptReporters: false, items: [{text: "Force", value: "addForce"},{text: "Torque (rotation)", value: "addTorque"},{text: "Apply Impulse", value: "applyImpulse"},{text: "Apply Torque Impulse (rotation)", value: "applyTorqueImpulse"},{text: "Linear Velocity", value: "setLinvel"},{text: "Angular Velocity", value: "setAngvel"},]},
        resetF: {acceptReporters: false, items: [{text:"Forces", value: "resetForces"},{text:"Torques", value: "resetTorques"},]}
        }
    }
    }
    joint(jointData, bodyA, bodyB) {
    physicsWorld.createImpulseJoint(jointData, bodyA.rigidBody, bodyB.rigidBody, true)
    }

    fixedJoint(args) {
    const VA = JSON.parse(args.VA).map(Number)
    const VB = JSON.parse(args.VB).map(Number)
    let RA = JSON.parse(args.RA).map(Number)
    let RB = JSON.parse(args.RB).map(Number)

    RA = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
        THREE.MathUtils.degToRad(RA[0]),
        THREE.MathUtils.degToRad(RA[1]),
        THREE.MathUtils.degToRad(RA[2])
        )
    )
    RB = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(
        THREE.MathUtils.degToRad(RB[0]),
        THREE.MathUtils.degToRad(RB[1]),
        THREE.MathUtils.degToRad(RB[2])
        )
    )

    const data = RAPIER.JointData.fixed(
        { x: VA[0], y: VA[1], z: VA[2] }, RA,
        { x: VB[0], y: VB[1], z: VB[2] }, RB
    )
    const objectA = _Extra3D_.getObject(args.ObjA)
    let object = _Extra3D_.getObject(args.ObjB)
    this.joint(data, objectA, object)
    }

    sphericalJoint(args) {
    const VA = JSON.parse(args.VA).map(Number)
    const VB = JSON.parse(args.VB).map(Number)

    const data = RAPIER.JointData.spherical(
        { x: VA[0], y: VA[1], z: VA[2] },
        { x: VB[0], y: VB[1], z: VB[2] }
    )
    const objectA = _Extra3D_.getObject(args.ObjA)
    let object = _Extra3D_.getObject(args.ObjB)
    this.joint(data, objectA, object)
    }

    revoluteJoint(args) {
    const VA = JSON.parse(args.VA).map(Number)
    const VB = JSON.parse(args.VB).map(Number)
    const x = JSON.parse(args.X).map(Number)

    const data = RAPIER.JointData.revolute(
        { x: VA[0], y: VA[1], z: VA[2] },
        { x: VB[0], y: VB[1], z: VB[2] }, { x: x[0], y: x[1], z: x[2] },
    )
    const objectA = _Extra3D_.getObject(args.ObjA)
    let object = _Extra3D_.getObject(args.ObjB)
    this.joint(data, objectA, object)
    }

    prismaticJoint(args) {
    const VA = JSON.parse(args.VA).map(Number)
    const VB = JSON.parse(args.VB).map(Number)
    const x = JSON.parse(args.X).map(Number)

    const data = RAPIER.JointData.prismatic(
        { x: VA[0], y: VA[1], z: VA[2] },
        { x: VB[0], y: VB[1], z: VB[2] }, { x: x[0], y: x[1], z: x[2] },
    )
    const objectA = _Extra3D_.getObject(args.ObjA)
    let object = _Extra3D_.getObject(args.ObjB)
    this.joint(data, objectA, object)
    }

    initWorld() {
      physicsWorld = new RAPIER.World({x: 0, y: -9.81, z: 0})
    }
    setGravity(args) {
      const v3 = JSON.parse(args.G).map(Number)
      const gravity = { x: v3[0], y: v3[1], z: v3[2]}
      physicsWorld.gravity = gravity
    }

    getWorld(args) {
    if (args.PROPERTY === "log") {console.log(physicsWorld); return "logged"}
    return JSON.stringify(physicsWorld[args.PROPERTY])
    }

    setRB(args) {
    let value = args.VALUE
    if (args.VALUE === "true" || args.VALUE === "false") value = !!args.VALUE
    let object = _Extra3D_.getObject(args.OBJECT)
    object.rigidBody[args.PROPERTY](value)
    }
    setC(args) {
    let value = args.VALUE
    if (args.VALUE === "true" || args.VALUE === "false") value = !!args.VALUE
    let object = _Extra3D_.getObject(args.OBJECT)
    object.collider[args.PROPERTY](value)
    }

    getRB(args) {
    let object = _Extra3D_.getObject(args.OBJECT)
    return JSON.stringify(object.rigidBody[args.PROPERTY]())
    }
    getC(args) {
    let object = _Extra3D_.getObject(args.OBJECT)
    return JSON.stringify(object.collider[args.PROPERTY]())
    }

    lockObjectAxis(args) {
    let object = _Extra3D_.getObject(args.OBJECT)
    const x =  !JSON.parse(args.X)
    const y = !JSON.parse(args.Y)
    const z = !JSON.parse(args.Z)
    object.rigidBody[args.PROPERTY](x,y,z,true) //changes is xyz, wake up
    }

    objectPhysics(args) {
    let object = _Extra3D_.getObject(args.OBJECT)
    object.physics = JSON.parse(args.state)

    if (JSON.parse(args.state)) {
        //if already exists delete:
        if (object.rigidBody) {
        physicsWorld.removeRigidBody(object.rigidBody)
        object.rigidBody = null
        object.collider = null
        }
        /*asing a rigidbody and collider to object and add them to physicsWorld*/
    let rigidBodyDesc = RAPIER.RigidBodyDesc[args.type]()
        .setTranslation(object.position.x, object.position.y, object.position.z)
        .setRotation({w: object.quaternion._w, x: object.quaternion._x, y: object.quaternion._y, z: object.quaternion._z})

    let colliderDesc
    switch(args.collider) {
        case "cuboid": colliderDesc = createCuboidCollider(object,); break
        case "ball": colliderDesc = createBallCollider(object); break
        case "convexHull": colliderDesc = createConvexHullCollider(object); break
        case "trimesh": colliderDesc = TriMesh(object); break
    }
    colliderDesc.setSensor(JSON.parse(args.state2)).setMass(args.mass).setDensity(args.density).setFriction(args.friction)

    let rigidBody = physicsWorld.createRigidBody(rigidBodyDesc)
    let collider = physicsWorld.createCollider(colliderDesc, rigidBody)

    object.rigidBody = rigidBody
    object.collider = collider
    } else {
        /*if disabling physics, delete rigidbody and collider from physicsWorld and object*/
        physicsWorld.removeRigidBody(object.rigidBody)
        object.rigidBody = null
        object.collider = null
    }

    }

    enableCCD(args) {
    let object = _Extra3D_.getObject(args.OBJECT)
    if (object.physics) {
        let rigidBody = object.rigidBody
        rigidBody.enableCcd(JSON.parse(args.state))
    }
    }

    addForce(args) {
    let object = _Extra3D_.getObject(args.OBJECT)
    const vector = JSON.parse(args.VALUE).map(Number)

    let force = new THREE.Vector3(vector[0],vector[1],vector[2])
    if (args.SPACE === "local") {
        force.applyQuaternion(object.quaternion);
    }

    object.rigidBody[args.PROPERTY](force,true)
    }

    resetForces(args) {
    rigidBody[args.PROPERTY](true)
    }

    sensorSingle(args) {
    const sensor = _Extra3D_.getObject(args.SENSOR)

    let object = _Extra3D_.getObject(args.OBJECT)

    let touching = false
    physicsWorld.intersectionPairsWith(sensor.collider, otherCollider => {
    if (otherCollider === object.collider) touching = true
    })

    return touching
    }

    sensorAll(args) {
    const sensor = _Extra3D_.getObject(args.SENSOR)

    const touchedObjects = []

    // loop thruogh every collider touching sensor
    physicsWorld.intersectionPairsWith(sensor.collider, otherCollider => {
    // find owner of collider
    const otherObject = _Extra3D_.SCENE.children.find(o => o.collider === otherCollider)
    console.log(otherCollider)
    if (otherObject) touchedObjects.push(otherObject.name)
    })

    return JSON.stringify(touchedObjects)
    }

    }
    Scratch.extensions.register(new RapierPhysics())

    physicsWorld = new RAPIER.World({x: 0, y: -9.81, z: 0})

  })
})(Scratch);