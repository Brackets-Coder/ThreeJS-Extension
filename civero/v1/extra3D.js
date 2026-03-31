// Name: Extra 3D
// ID: threejsExtension
// Description: Use three js inside Turbowarp! A 3D graphics library. 
// By: Civero <https://scratch.mit.edu/users/civero/> <https://civero.itch.io> <https://civ3ro.github.io/extensions>
// License: MIT License Copyright (c) 2021-2024 TurboWarp Extensions Contributors

(function (Scratch) {
  "use strict";

  if (!Scratch.extensions.unsandboxed) {throw new Error("Extension must run unsandboxed")}
  if (Scratch.vm.runtime.isPackaged) {alert(`Uncheck the setting "Remove raw asset data after loading to save RAM" for package!`); return}

  const vm = Scratch.vm;
  const runtime = vm.runtime
  const renderer = Scratch.renderer;
  const canvas = renderer.canvas 
  const Cast = Scratch.Cast;
  
  let alerts = false
  console.log('Loading Extra3D')
  console.log("alerts are " + (alerts ? "enabled" : "disabled"))

  let isMouseDown = { left: false, middle: false, right: false }
  let prevMouse = { left: false, middle: false, right: false }
  let lastWidth = 0
  let lastHeight = 0

  let THREE
  let clock
  let running
  let loopId

  //Addons
  let TextGeometry
  let fontLoad
  let OrbitControls
  let controls
  //Physics
  let RAPIER
  let physicsWorld

  let threeRenderer
  let scene
  let camera
  let eulerOrder = "YXZ"
  let renderTargets = {}
  let materials = {}
  let geometries = {}
  let lights = {}
  let assets = { //should i place materials, geometries; inside too?
    textures: {},
    fogs: {},
    curves: {},
    renderTargets: {}, //not the same as the global one! this one only stores textures
  }
  let rect 
  let raycastResult = []

  function resetor(level) {
    camera = undefined

    renderTargets = {}

    materials = {}
    geometries = {}
    lights = {}

    if (level > 0) {
      assets = {
        textures: {},
        colors: {},
        fogs: {},
        curves: {},
        renderTargets: {},
      }
    }

    if (_Extra3D_.COMPOSER) _Extra3D_.resetComposer()
  }
  //utility
  function vector3ToString(prop) {
    if (!prop) return "0,0,0";

    const x = (typeof(prop.x) === "number") ? prop.x : (typeof(prop._x) === "number") ? prop._x : (JSON.stringify(prop).includes("X")) ? prop : 0
    const y = (typeof(prop.y) === "number") ? prop.y : (typeof(prop.y) === "number") ? prop._y : 0
    const z = (typeof(prop.z) === "number") ? prop.z : (typeof(prop.z) === "number") ? prop.z : 0

    return [x, y, z]
  }
  //objects
  function createObject(name, content, parentName) {
    let object = getObject(name, true)
    if (object) {
      removeObject(name)
      alerts ? alert(name + " already exsisted, will replace!") : null
    }
    content.name = name
    parentName === scene.name ? object = scene : object = getObject(parentName)
    content.physics = false

    object.add(content)
  }
  function removeObject(name) {
    let object = getObject(name)
    if (!object) return

    scene.remove(object)

    if (object.rigidBody) {
      _Extra3D_.PhysicsWorld.removeCollider(object.collider, true)
      _Extra3D_.PhysicsWorld.removeRigidBody(object.rigidBody, true)
      object.rigidBody = null
      object.collider = null
    }
    if (object.isLight) {
      delete(lights[name])
    }
  }
  function getObject(name, isNew) {
    let object = null
    if (!scene) {
      alerts ? alert("Can not get " + name + ". Create a scene first!") : null; return;}
    object = scene.getObjectByName(name)
    if (!object && !isNew) {alerts ? alert(name + " does not exist! Add it to scene"):null; return;}
    return object
  }
  //materials
  function encodeCostume (name) {
    if (name.startsWith("data:image/")) return name
    return Scratch.vm.editingTarget.sprite.costumes.find(c => c.name === name).asset.encodeDataURI()
  }
  function setTexture (texture, mode, style, x, y) {
    texture.colorSpace = THREE.SRGBColorSpace

    if (mode === "Pixelate") {
    texture.minFilter = THREE.NearestFilter;
    texture.magFilter = THREE.NearestFilter;
    } else { //Blur
    //texture.minFilter = THREE.NearestMipmapLinearFilter
    //texture.magFilter = THREE.NearestMipmapLinearFilter
    }

    if (style === "Repeat") {
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(x, y)
    }

    texture.generateMipmaps = true;
  }
  async function resizeImageToSquare(uri, size = 128) {
      return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        canvas.width = size
        canvas.height = size
        const ctx = canvas.getContext('2d')
        
        // clear + draw image scaled to fit canvas
        ctx.clearRect(0, 0, size, size)
        ctx.drawImage(img, 0, 0, size, size)

        resolve(canvas.toDataURL()) // return normalized Data URI
        canvas.remove()
      };
      img.src = uri
    });
  }
  //light
  function updateShadowFrustum(light, focusPos) {
      if (light.type !== "DirectionalLight") return

      // Frustum Size - Increase this value to cover a larger area.
      const d = 50;

      // Update Orthographic Shadow Camera Frustum
      const shadowCamera = light.shadow.camera;
      
      // Set the width/height of the frustum
      shadowCamera.left = -d;
      shadowCamera.right = d;
      shadowCamera.top = d;
      shadowCamera.bottom = -d;
      
      // Determine ranges
      shadowCamera.near = 0.1
      shadowCamera.far = 500

      // Position the Light and its Target
      light.target.position.copy(focusPos);
      const direction = light.position.clone().sub(light.target.position).normalize();
      light.position.copy(focusPos.clone().add(direction.multiplyScalar(100)));

      // Ensure matrices are updated.
      light.target.updateMatrixWorld();
      light.shadow.camera.updateProjectionMatrix()
      light.shadow.needsUpdate = true; 
  }
  //utility
  function getMouseNDC(event) {
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    return [x, y];
  }
  function checkCanvasSize() {
    const pr = window.devicePixelRatio
    const width = canvas.width*1/pr
    const height = canvas.height*1/pr

    if (width !== lastWidth || height !== lastHeight) {
      lastWidth = width
      lastHeight = height
      resize()
    }
    requestAnimationFrame(checkCanvasSize) //rerun next frame
  }

  async function openFileExplorer(format) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
        input.type = "file"
        input.accept = format
        input.multiple = false
        input.onchange = () => {
          resolve(input.files)
          input.remove()
        };
        input.click();
    })
  }
  function getMeshesUsingTexture(scene, targetTexture) {
      const meshes = []

      scene.traverse(object => {
          if (object.material) {
              const materials = Array.isArray(object.material) ? object.material : [object.material]
              for (const material of materials) {
                  if (material.map === targetTexture) {
                      meshes.push(object)
                      break
                  }
              }
          }
      })

      return meshes
  }
  function getAsset(path) {
    if (typeof(path) == "string") { //string?
      if (path.includes("/")) { //has the /?
        const value = path.split("/")
        console.log(value[0], value[1])
        return assets[value[0]][value[1]]
      } else if (path.charAt(0) === "#") return new THREE.Color(path)
    }

    return JSON.parse(path) //boolean or number
  }
  let mouseNDC = [0, 0]

  //loops/init
  function stopLoop() {
    if (!running) return
    running = false

    if (loopId) {
      cancelAnimationFrame(loopId)
      loopId = null
    }
  }
  async function load() {
    if (!THREE) {
      THREE = await import("https://esm.sh/three@0.180.0")
      
      //Addons
      TextGeometry = await import("https://esm.sh/three@0.158.0/examples/jsm/geometries/TextGeometry.js") //old version due to TextDepth not working properly in @180
      const FontLoader = await import("https://esm.sh/three@0.158.0/examples/jsm/loaders/FontLoader.js")
      fontLoad = new FontLoader.FontLoader()

      OrbitControls = await import("https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js")

      threeRenderer = new THREE.WebGLRenderer({
        powerPreference: "high-performance",
        antialias: false,
        stencil: false,
        depth: true
      })
      threeRenderer.setPixelRatio(window.devicePixelRatio)
      threeRenderer.outputColorSpace = THREE.SRGBColorSpace // correct colors
      //threeRenderer.toneMapping = THREE.ACESFilmicToneMapping // HDR look (test)
      //threeRenderer.toneMappingExposure = 1.0 //(test)

      threeRenderer.shadowMap.enabled = true
      threeRenderer.shadowMap.type = THREE.PCFSoftShadowMap // (optional)
      threeRenderer.domElement.style.pointerEvents = 'auto' //will disable turbowarp mouse events, but enable threejs's
      
      //API? Communication with other extensions
      window._Extra3D_ = {
        THREE: THREE,
        get THREERENDERER() {return threeRenderer},
        get SCENE() {return scene},
        get CAMERA() {return camera},
        get MATERIALS() {return materials},
        get GEOMETRIES() {return geometries},

        getObject: getObject,
        createObject: createObject,
        removeObject: removeObject,
        getAsset: getAsset,

        onUpdate: [],
      }

      clock = new THREE.Clock()
      
      renderer.addOverlay( threeRenderer.domElement, "manual" )
      renderer.addOverlay(canvas, "manual")
      renderer.setBackgroundColor(1, 1, 1, 0)

      resize()

      window.addEventListener("mousedown", e => {
        if (e.button === 0) isMouseDown.left = true
        if (e.button === 1) isMouseDown.middle = true
        if (e.button === 2) isMouseDown.right = true
      })
      window.addEventListener("mouseup", e => {
        if (e.button === 0) isMouseDown.left = false; prevMouse.left = false
        if (e.button === 1) isMouseDown.middle = false; prevMouse.middle = false
        if (e.button === 2) isMouseDown.right = false; prevMouse.right = false
      })
      // prevent contextmenu on right click
      threeRenderer.domElement.addEventListener("contextmenu", e => e.preventDefault());

      threeRenderer.domElement.addEventListener('mousemove', (event) => {
        mouseNDC = getMouseNDC(event);
      })

      running = false
      load()

      startRenderLoop()
      runtime.on('PROJECT_START', () => startRenderLoop())
      runtime.on('PROJECT_STOP_ALL', () => stopLoop())
      runtime.on('STAGE_SIZE_CHANGED', () => {requestAnimationFrame(() => resize())})
      let lastRatio = window.devicePixelRatio;
      window.addEventListener('resize', () => {
          if (window.devicePixelRatio !== lastRatio) { //not working... mmmh
              lastRatio = window.devicePixelRatio;
          }
          requestAnimationFrame(() => resize())
      })
      checkCanvasSize()
    }
  }
  function startRenderLoop() {
    if (running) return
    running = true

    const loop = () => {
      if (!running) return
      
      const delta = clock.getDelta()
      _Extra3D_.onUpdate.forEach(f => f(delta)) //run other functions, from Addons Extension or User made. This is called an Array "Hook"

      if (scene && camera) {
        if (controls) controls.update()

        Object.values(lights).forEach(light => updateShadowFrustum(light, camera.position))

        Object.values(renderTargets).forEach(t => {
          if ( t.camera.type == "PerspectiveCamera") {
            t.camera.aspect = t.target.width / t.target.height
            t.camera.updateProjectionMatrix()
          }
          // get meshes using the texture associated with this target
          const displayMeshes = getMeshesUsingTexture(scene, t.target.texture)

          displayMeshes.forEach(mesh => {
            mesh.visible = false
          })

          if (t.camera.type == "PerspectiveCamera") {
          threeRenderer.setRenderTarget(t.target)
          threeRenderer.clear(true, true, true)
          threeRenderer.render(scene, t.camera)
          } else {
            t.target.clear(threeRenderer)
            t.camera.update( threeRenderer, scene ) //cubeCamera
          }

          displayMeshes.forEach(mesh => {
          mesh.visible = true
          })
        })
        camera.aspect = threeRenderer.domElement.width / threeRenderer.domElement.height //is this slow?
        camera.updateProjectionMatrix()
        threeRenderer.setRenderTarget(null) //to canvas

        if (_Extra3D_.COMPOSER) _Extra3D_.COMPOSER.render(delta) //from addons extension. Should I move it to addons as a Hook? Add a boolean to render from threeRenderer => addon renders 
        else threeRenderer.render(scene, camera)
      }

      loopId = requestAnimationFrame(loop)
    }
    loopId = requestAnimationFrame(loop)
  }
  function resize() {
    
    const pr = window.devicePixelRatio
    const w = canvas.width*(1/pr)
    const h = canvas.height*(1/pr)

    threeRenderer.setSize(w, h)
    if (_Extra3D_.COMPOSER) _Extra3D_.COMPOSER.setSize(w, h)

    if (_Extra3D_.CustomEffects) _Extra3D_.CustomEffects.forEach(e => {
      if (e.uniforms.get('resolution')) {
      e.uniforms.get('resolution').value.set(w,h)
      }
    })

    if (camera) {
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    }

    rect = threeRenderer.domElement.getBoundingClientRect()
  }

  //Thanks to the PointerLock extension of Turbowarp
  const mouse = vm.runtime.ioDevices.mouse;
  let isLocked = false;
  let isPointerLockEnabled = false;

  const postMouseData = (e, isDown) => {
      const { movementX, movementY } = e;
      const { width, height } = rect;
      const x = mouse._clientX + movementX;
      const y = mouse._clientY - movementY;
      mouse._clientX = x;
      mouse._scratchX = mouse.runtime.stageWidth * (x / width - 0.5);
      mouse._clientY = y;
      mouse._scratchY = mouse.runtime.stageHeight * (y / height - 0.5);
      if (typeof isDown === "boolean") {
      const data = {
          button: e.button,
          isDown,
      };
      originalPostIOData(data);
      }
  };

  const mouseDevice = vm.runtime.ioDevices.mouse;
  const originalPostIOData = mouseDevice.postData.bind(mouseDevice);
  mouseDevice.postData = (data) => {
      if (!isPointerLockEnabled) {
      return originalPostIOData(data);
      }
  };

  document.addEventListener(
      "mousedown",
      (e) => {
      // @ts-expect-error
      if (threeRenderer.domElement.contains(e.target)) {
          if (isLocked) {
          postMouseData(e, true);
          } else if (isPointerLockEnabled) {
          threeRenderer.domElement.requestPointerLock();
          }
      }
      },
      true
  );
  document.addEventListener(
      "mouseup",
      (e) => {
      if (isLocked) {
          postMouseData(e, false);
          // @ts-expect-error
      } else if (isPointerLockEnabled && threeRenderer.domElement.contains(e.target)) {
          threeRenderer.domElement.requestPointerLock();
      }
      },
      true
  );
  document.addEventListener(
      "mousemove",
      (e) => {
      if (isLocked) {
          postMouseData(e);
      }
      },
      true
  );

  document.addEventListener("pointerlockchange", () => {
      isLocked = document.pointerLockElement === threeRenderer.domElement;
  });
  document.addEventListener("pointerlockerror", (e) => {
      console.error("Pointer lock error", e);
  });

  const oldStep = vm.runtime._step;
  vm.runtime._step = function (...args) {
      const ret = oldStep.call(this, ...args);
      if (isPointerLockEnabled) {
      const { width, height } = rect;
      mouse._clientX = width / 2;
      mouse._clientY = height / 2;
      mouse._scratchX = 0;
      mouse._scratchY = 0;
      }
      return ret;
  };

  vm.runtime.on("PROJECT_LOADED", () => {
      isPointerLockEnabled = false;
      if (isLocked) {
      document.exitPointerLock();
      }
  });
  

  const sceneBlocks = [
    {blockType: Scratch.BlockType.LABEL, text: "Scene:"},
    {opcode: "newScene", blockType: Scratch.BlockType.COMMAND, text: "new Scene [NAME]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "scene"}}},
    {opcode: "setSceneProperty", extensions: ["colours_looks"], blockType: Scratch.BlockType.COMMAND, text: "set Scene [PROPERTY] to [VALUE]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "sceneProperties", defaultValue: "background"}, VALUE: {type: Scratch.ArgumentType.STRING, defaultValue: "#9966ff", exemptFromNormalization: true}}},
    "---",
    {opcode: "getSceneObjects", blockType: Scratch.BlockType.REPORTER, text: "get Scene [THING]", arguments:{THING: {type: Scratch.ArgumentType.STRING, menu: "sceneThings"}}},
    {opcode: "reset", blockType: Scratch.BlockType.COMMAND, text: "Reset Everything"}
  ].map(b => typeof b === 'string' ? b : {...b, color1: "#89B6A5", color2: "#67887bff", color3: "#618074ff"})
  const sceneMenus = {
    sceneProperties: {acceptReporters: false, items: [
      {text: "Background", value: "background"},{text: "Background Blurriness", value: "backgroundBlurriness"},{text: "Background Intensity", value: "backgroundIntensity"},{text: "Background Rotation", value: "backgroundRotation"},
      {text: "Environment", value: "environment"},{text: "Environment Intensity", value: "environmentIntensity"},{text: "Environment Rotation", value: "environmentRotation"},{text: "Fog", value: "fog"},
    ]},
    sceneThings: {acceptReporters: false, items: ["Objects", "Materials", "Geometries","Lights","Scene Properties","Other assets"]},
  }
  const cameraBlocks = [
    {blockType: Scratch.BlockType.LABEL, text: "Cameras:"},
    {opcode: "addCamera", blockType: Scratch.BlockType.COMMAND, text: "add camera [TYPE] [CAMERA] to [GROUP]", arguments: {GROUP: {type: Scratch.ArgumentType.STRING, defaultValue: "scene"},CAMERA: {type: Scratch.ArgumentType.STRING, defaultValue: "myCamera"}, TYPE: {type: Scratch.ArgumentType.STRING, menu: "cameraTypes"}}},
    {opcode: "setCamera", blockType: Scratch.BlockType.COMMAND, text: "set camera [PROPERTY] of [CAMERA] to [VALUE]", arguments: {CAMERA: {type: Scratch.ArgumentType.STRING, defaultValue: "myCamera"}, PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "cameraProperties"}, VALUE: {type: Scratch.ArgumentType.STRING, defaultValue: "0.1", exemptFromNormalization: true}}},
    {opcode: "getCamera", blockType: Scratch.BlockType.REPORTER, text: "get camera [PROPERTY] of [CAMERA]", arguments: {CAMERA: {type: Scratch.ArgumentType.STRING, defaultValue: "myCamera"}, PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "cameraProperties"}}},
    "---",
    {opcode: "renderSceneCamera", blockType: Scratch.BlockType.COMMAND, text: "set rendering camera to [CAMERA]", arguments: {CAMERA: {type: Scratch.ArgumentType.STRING, defaultValue: "myCamera"}}},
    "---",
    {opcode: "cubeCamera", blockType: Scratch.BlockType.COMMAND, text: "add cube camera [CAMERA] to [GROUP] with RenderTarget [RT]", arguments: {CAMERA: {type: Scratch.ArgumentType.STRING, defaultValue: "cubeCamera"}, GROUP: {type: Scratch.ArgumentType.STRING, defaultValue: "scene"}, RT: {type: Scratch.ArgumentType.STRING, defaultValue: "myTarget"}, } },
    "---",
    {opcode: "renderTarget", blockType: Scratch.BlockType.COMMAND, text: "set a RenderTarget: [RT] for camera [CAMERA]", arguments: {CAMERA: {type: Scratch.ArgumentType.STRING, defaultValue: "myCamera"}, RT: {type: Scratch.ArgumentType.STRING, defaultValue: "myTarget"}, } },
    {opcode: "sizeTarget", blockType: Scratch.BlockType.COMMAND, text: "set RenderTarget [RT] size to [W] [H]", arguments: {RT: {type: Scratch.ArgumentType.STRING, defaultValue: "myTarget"}, W: {type: Scratch.ArgumentType.NUMBER, defaultValue: 480}, H: {type: Scratch.ArgumentType.NUMBER, defaultValue: 360},} },
    {opcode: "getTarget", blockType: Scratch.BlockType.REPORTER, text: "get RenderTarget: [RT] texture", arguments: {RT: {type: Scratch.ArgumentType.STRING, defaultValue: "myTarget"}} },
    {opcode: "removeTarget", blockType: Scratch.BlockType.COMMAND, text: "remove RenderTarget: [RT]", arguments: {RT: {type: Scratch.ArgumentType.STRING, defaultValue: "myTarget"}} },
  ].map(b => typeof b === 'string' ? b : {...b, color1: "#4C3B4D", color2: "#725974ff", color3: "#725974ff"})
  const cameraMenus = {
    cameraTypes: {acceptReporters: false, items: [{text: "Perspective", value: "PerspectiveCamera"},]},
    cameraProperties: {acceptReporters: false, items: [
        {text: "Near", value: "near"},{text: "Far", value: "far"},{text: "FOV", value: "fov"},{text: "Focus (nothing...)", value: "focus"},{text: "Zoom", value: "zoom"},
    ]},
  }
  const objectBlocks = [
        {blockType: Scratch.BlockType.LABEL, text: "Objects:"},
    {opcode: "addObject", blockType: Scratch.BlockType.COMMAND, text: "add object [OBJECT3D] [TYPE] to [GROUP]", arguments: {GROUP: {type: Scratch.ArgumentType.STRING, defaultValue: "scene"},TYPE: {type: Scratch.ArgumentType.STRING, menu: "objectTypes"},OBJECT3D: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},
    {opcode: "cloneObject", blockType: Scratch.BlockType.COMMAND, text: "clone object [OBJECT3D] as [NAME] & add to [GROUP]", arguments: {GROUP: {type: Scratch.ArgumentType.STRING, defaultValue: "scene"},NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myClone"},OBJECT3D: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},
    "---",
    {opcode: "setObject", blockType: Scratch.BlockType.COMMAND, text: "set [PROPERTY] of object [OBJECT3D] to [NAME]", arguments: {OBJECT3D: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}, PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "objectProperties"}, NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myGeometry"}}},
    {opcode: "getObject", blockType: Scratch.BlockType.REPORTER, text: "get [PROPERTY] of object [OBJECT3D]", arguments: {OBJECT3D: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}, PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "objectProperties"}}},
    {opcode: "objectE", blockType: Scratch.BlockType.BOOLEAN, text: "is there an object [NAME]?", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},
    "---",
    {opcode: "removeObject", blockType: Scratch.BlockType.COMMAND, text: "remove object [OBJECT3D] from scene", arguments: {OBJECT3D: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},

    {blockType: Scratch.BlockType.LABEL, text: " ↳ Transforms"},            
    {opcode: "setObjectV3",extensions: ["colours_motion"], blockType: Scratch.BlockType.COMMAND, text: "set transform [PROPERTY] of [OBJECT3D] to [VALUE]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "objectVector3", defaultValue: "position"}, OBJECT3D: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}, VALUE: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"}}},           
    {opcode: "getObjectV3",extensions: ["colours_motion"], blockType: Scratch.BlockType.REPORTER, text: "get [PROPERTY] of [OBJECT3D]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "objectVector3", defaultValue: "position"}, OBJECT3D: {type: Scratch.ArgumentType.STRING, defaultValue: "myObject"}}},

    {blockType: Scratch.BlockType.LABEL, text: "↳ Geometries"},
    {opcode: "newGeometry",extensions: ["colours_data_lists"], blockType: Scratch.BlockType.COMMAND, text: "new geometry [NAME] [TYPE]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myGeometry"}, TYPE: {type: Scratch.ArgumentType.STRING, menu: "geometryTypes", defaultValue: "BoxGeometry"}}},
    {opcode: "geometryE",extensions: ["colours_data_lists"], blockType: Scratch.BlockType.BOOLEAN, text: "is there a geometry [NAME]?", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myGeometry"}}},
    {opcode: "removeGeometry",extensions: ["colours_data_lists"], blockType: Scratch.BlockType.COMMAND, text: "remove geometry [NAME]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myGeometry"}}},
    "---",
    {opcode: "newGeo",extensions: ["colours_data_lists"], blockType: Scratch.BlockType.COMMAND, text: "new empty geometry [NAME]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myGeometry"}, POINTS: {type: Scratch.ArgumentType.STRING, defaultValue: "[points]"}}},
    {opcode: "geoPoints",extensions: ["colours_data_lists"], blockType: Scratch.BlockType.COMMAND, text: "set geometry [NAME] vertex points to [POINTS]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myGeometry"}, POINTS: {type: Scratch.ArgumentType.STRING, defaultValue: "[points]"}}},
    {opcode: "geoUVs",extensions: ["colours_data_lists"], blockType: Scratch.BlockType.COMMAND, text: "set geometry [NAME] UVs to [POINTS]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myGeometry"}, POINTS: {type: Scratch.ArgumentType.STRING, defaultValue: "[UVs]"}}},
    "---",
    {opcode: "splines", extensions: ["colours_data_lists"], blockType: Scratch.BlockType.COMMAND, text: "create spline [NAME] from curve [CURVE]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "mySpline"}, CURVE: {type: Scratch.ArgumentType.STRING, defaultValue: "[curve]", exemptFromNormalization: true}}},
    "---",
    {blockType: Scratch.BlockType.BUTTON, text: "Convert font to JSON", func: "openConv"},
    {blockType: Scratch.BlockType.BUTTON, text: "Load JSON font file", func: "loadFont"},
    {opcode: "text", extensions: ["colours_data_lists"], blockType: Scratch.BlockType.COMMAND, text: "create text geometry [NAME] with text [TEXT] in font [FONT] size [S] depth [D] curvedSegments [CS]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myText"}, TEXT: {type: Scratch.ArgumentType.STRING, defaultValue: "Civero!"}, FONT: {type: Scratch.ArgumentType.STRING, menu: "fonts"}, S: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1}, D: {type: Scratch.ArgumentType.NUMBER, defaultValue: 0.1}, CS: {type: Scratch.ArgumentType.NUMBER, defaultValue: 6}}},
  
    {blockType: Scratch.BlockType.LABEL, text: "↳ Materials"},
    {opcode: "newMaterial",extensions: ["colours_looks"], blockType: Scratch.BlockType.COMMAND, text: "new material [NAME] [TYPE]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myMaterial"}, TYPE: {type: Scratch.ArgumentType.STRING, menu: "materialTypes", defaultValue: "MeshStandardMaterial"}}},
    {opcode: "materialE",extensions: ["colours_looks"], blockType: Scratch.BlockType.BOOLEAN, text: "is there a material [NAME]?", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myMaterial"}}},
    {opcode: "removeMaterial",extensions: ["colours_looks"], blockType: Scratch.BlockType.COMMAND, text: "remove material [NAME]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myMaterial"}}},
    {opcode: "setMaterial",extensions: ["colours_looks"], blockType: Scratch.BlockType.COMMAND, text: "set material [PROPERTY] of [NAME] to [VALUE]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "materialProperties", defaultValue: "color"},NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myMaterial"}, VALUE: {type: Scratch.ArgumentType.STRING, defaultValue: "#9966ff", exemptFromNormalization: true}}},
    {opcode: "setBlending",extensions: ["colours_looks"], blockType: Scratch.BlockType.COMMAND, text: "set material [NAME] blending to [VALUE]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myMaterial"}, VALUE: {type: Scratch.ArgumentType.STRING, menu: "blendModes"}}},
    {opcode: "setDepth",extensions: ["colours_looks"], blockType: Scratch.BlockType.COMMAND, text: "set material [NAME] depth to [VALUE]", arguments: {NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myMaterial"}, VALUE: {type: Scratch.ArgumentType.STRING, menu: "depthModes"}}},
  
  ].map(b => typeof b === 'string' ? b : {...b, color1: "#4bbea5ff", color2: "#4da891ff", color3: "#297e62ff"})
  const objectMenus = {
    objectVector3: {acceptReporters: false, items: [
    {text: "Positon", value: "position"},{text: "Rotation", value: "rotation"},{text: "Scale", value: "scale"},{text: "Facing Direction (.up)", value: "up"}
    ]},
    objectProperties: {acceptReporters: false, items: [
    {text: "Geometry", value: "geometry"},{text: "Material", value: "material"},{text: "Visible (true/false)", value: "visible"},
    ]},
    objectTypes: { acceptReporters: false, items: [
    { text: "Mesh", value: "Mesh" }, { text: "Sprite", value: "Sprite" }, { text: "Points", value: "Points" }, { text: "Line", value: "Line" }, { text: "Group", value: "Group" }
    ]},
    XYZ: {acceptReporters: false, items: [{text: "X", value: "x"},{text: "Y", value: "y"},{text: "Z", value: "z"}]},
    materialProperties: {acceptReporters: false, items: [
    "|GENERAL| <-- not a property",
    { text: "Color", value: "color" },
    { text: "Map", value: "map" },
    { text: "Opacity", value: "opacity" },
    { text: "Transparent", value: "transparent" },
    { text: "Alpha Map", value: "alphaMap" },
    { text: "Alpha Test", value: "alphaTest" },
    { text: "Depth Test", value: "depthTest" },
    { text: "Depth Write", value: "depthWrite" },
    { text: "Color Write", value: "colorWrite" },
    { text: "Side", value: "side" },
    { text: "Visible", value: "visible" },
    { text: "Blend Aplha", value: "blendAplha" },
    { text: "Blend Color", value: "blendColor" },
    { text: "Alpha Hash", value: "alphaHash" },
    { text: "Premultiplied Alpha", value: "premultipliedAlpha" },

    { text: "Tone Mapped", value: "toneMapped" },
    { text: "Fog", value: "fog" },
    { text: "Flat Shading", value: "flatShading" },

    "|MESH Standard / Physical| <-- not a property",
    { text: "Metalness", value: "metalness" },
    { text: "Metalness Map", value: "metalnessMap" },
    { text: "Roughness", value: "roughness" },
    { text: "Reflectivity", value: "reflectivity" },
    { text: "Roughness Map", value: "roughnessMap" },
    { text: "Emissive Color", value: "emissive" },
    { text: "Emissive Intensity", value: "emissiveIntensity" },
    { text: "Emissive Map", value: "emissiveMap" },
    { text: "Env Map", value: "envMap" },
    { text: "Env Map Intensity", value: "envMapIntensity" },
    { text: "Env Map Rotation", value: "envMapRotation" },
    { text: "Ior", value: "ior" },
    { text: "Refraction Ratio", value: "refractionRatio" },
    { text: "Clearcoat", value: "clearcoat" },
    { text: "Clearcoat Map", value: "clearcoatMap" },
    { text: "Clearcoat Roughness", value: "clearcoatRoughness" },
    { text: "Clearcoat Roughness Map", value: "clearcoatRoughnessMap" },
    { text: "Dispersion", value: "dispersion" },
    { text: "Sheen", value: "sheen" },
    { text: "Sheen Color", value: "sheenColor" },
    { text: "Sheen Color Map", value: "sheenColorMap" },
    { text: "Sheen Roughness", value: "sheenRoughness" },
    { text: "Sheen Roughness Map", value: "sheenRoughnessMap" },
    { text: "Specular Color", value: "specularColor" },
    { text: "Specular Color Map", value: "specularColorMap" },
    { text: "Specular Intensity", value: "specularIntensity" },
    { text: "Specular Intensity Map", value: "specularIntensityMap" },
    { text: "Transmission", value: "transmission" },
    { text: "Transmission Map", value: "transmissionMap" },
    { text: "Thickness", value: "thickness" },
    { text: "Thickness Map", value: "thicknessMap" },
    { text: "Anisotropy", value: "anisotropy" },
    { text: "Anisotropy Map", value: "anisotropyMap" },
    { text: "Anisotropy Rotation", value: "anisotropyRotation" },
    { text: "Attenuation Distance", value: "attenuationDistance" },
    { text: "Attenuation Color", value: "attenuationColor" },
    { text: "Thickness", value: "thickness" },
    { text: "Iridescence", value: "iridescence" },
    { text: "Iridescence Ior", value: "iridescenceIOR" },
    { text: "Iridescence Map", value: "iridescenceMap" },
    { text: "Iridescence Thickness Range", value: "iridescenceThicknessRange" },

    "|MESH Displacement / Normal / Bump| <-- not a property",
    { text: "Displacement Map", value: "displacementMap" },
    { text: "Displacement Scale", value: "displacementScale" },
    { text: "Displacement Bias", value: "displacementBias" },
    { text: "Bump Map", value: "bumpMap" },
    { text: "Bump Scale", value: "bumpScale" },
    { text: "Normal Map Type", value: "normalMapType" },

    "|MESH Matcap / Toon / Phong / Lambert / Basic| <-- not a property",
    { text: "Shininess", value: "shininess" },

    { text: "Wireframe", value: "wireframe" },
    { text: "Wireframe Linewidth", value: "wireframeLinewidth" },
    { text: "Wireframe Linecap", value: "wireframeLinecap" },
    { text: "Wireframe Linejoin", value: "wireframeLinejoin" },

    "|POINTS| <-- not a property",
    { text: "Size", value: "size" },
    { text: "Size Attenuation", value: "sizeAttenuation" },

    "|LINES| <-- not a property",
    { text: "Scale", value: "scale" },
    { text: "Dash Size", value: "dashSize" },
    { text: "Gap Size", value: "gapSize" },

    "|SPRITES| <-- not a property",
    { text: "Rotation", value: "rotation" }
    ]},
    blendModes: {acceptReporters: false, items: [
    { text: "No Blending", value: "NoBlending" },{ text: "Normal Blending", value: "NormalBlending" },{ text: "Additive Blending", value: "AdditiveBlending" },{ text: "Subtractive Blending", value: "SubtractiveBlending" },{ text: "Multiply Blending", value: "MultiplyBlending" },{ text: "Custom Blending", value: "CustomBlending" }
    ]},
    depthModes: {acceptReporters: false, items: [
    { text: "Never Depth", value: "NeverDepth" },{ text: "Always Depth", value: "AlwaysDepth" },{ text: "Equal Depth", value: "EqualDepth" },{ text: "Less Depth", value: "LessDepth" },{ text: "Less Equal Depth", value: "LessEqualDepth" },{ text: "Greater Equal Depth", value: "GreaterEqualDepth" },{ text: "Greater Depth", value: "GreaterDepth" },{ text: "Not Equal Depth", value: "NotEqualDepth" }
    ]},
    materialTypes:{acceptReporters: false, items: [
    {text:"Mesh Basic Material",value:"MeshBasicMaterial"},{text:"Mesh Standard Material",value:"MeshStandardMaterial"},{text:"Mesh Physical Material",value:"MeshPhysicalMaterial"},{text:"Mesh Lambert Material",value:"MeshLambertMaterial"},{text:"Mesh Phong Material",value:"MeshPhongMaterial"},{text:"Mesh Depth Material",value:"MeshDepthMaterial"},{text:"Mesh Normal Material",value:"MeshNormalMaterial"},{text:"Mesh Matcap Material",value:"MeshMatcapMaterial"},{text:"Mesh Toon Material",value:"MeshToonMaterial"},{text:"Line Basic Material",value:"LineBasicMaterial"},{text:"Line Dashed Material",value:"LineDashedMaterial"},{text:"Points Material",value:"PointsMaterial"},{text:"Sprite Material",value:"SpriteMaterial"},{text:"Shadow Material",value:"ShadowMaterial"}
    ]},
    textureModes: {acceptReporters: false, items: ["Pixelate","Blur"]},
    textureStyles: {acceptReporters: false, items: ["Repeat","Clamp"]},
    geometryTypes: {acceptReporters: false, items: [
    {text: "Box Geometry", value: "BoxGeometry"},{text: "Sphere Geometry", value: "SphereGeometry"},{text: "Cylinder Geometry", value: "CylinderGeometry"},{text: "Plane Geometry", value: "PlaneGeometry"},{text: "Circle Geometry", value: "CircleGeometry"},{text: "Torus Geometry", value: "TorusGeometry"},{text: "Torus Knot Geometry", value: "TorusKnotGeometry"},
    ]},
    modelsList: {acceptReporters: false, items: () => {
    const stage = runtime.getTargetForStage();
    if (!stage) return ["(loading...)"];

    // @ts-ignore
    const models = Scratch.vm.runtime.getTargetForStage().getSounds().filter(e => e.name && e.name.endsWith('.glb'))
    if (models.length < 1) return [["Load a model! (GLB Loader category)"]]

    // @ts-ignore
    return models.map( m =>  [m.name] )
    }},
    fonts: {acceptReporters: false, items: () => {
    const stage = runtime.getTargetForStage();
    if (!stage) return ["(loading...)"];

    // @ts-ignore
    const models = Scratch.vm.runtime.getTargetForStage().getSounds().filter(e => e.name && e.name.endsWith('.json'))
    if (models.length < 1) return [["Load a font!"]]

    // @ts-ignore
    return models.map( m =>  [m.name] )
    }},
  }
  const lightBlocks = [
    {blockType: Scratch.BlockType.LABEL, text: "Lights:"},
    {opcode: "addLight", blockType: Scratch.BlockType.COMMAND, text: "add light [NAME] type [TYPE] to [GROUP]", arguments: {GROUP: {type: Scratch.ArgumentType.STRING, defaultValue: "scene"},NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myLight"}, TYPE: {type: Scratch.ArgumentType.STRING, menu: "lightTypes"}}},
    {opcode: "setLight", blockType: Scratch.BlockType.COMMAND, text: "set light [NAME][PROPERTY] to [VALUE]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "lightProperties", defaultValue: "intensity"},NAME: {type: Scratch.ArgumentType.STRING, defaultValue: "myLight"}, VALUE: {type: Scratch.ArgumentType.STRING, defaultValue: "1", exemptFromNormalization: true}}},
  ].map(b => typeof b === 'string' ? b : {...b, color1: "#C96480", color2: "#964c61ff", color3: "#974b61ff"})
  const lightMenus = {
    lightTypes: {acceptReporters: false, items: [
      {text: "Ambient Light", value: "AmbientLight"},{text: "Directional Light", value: "DirectionalLight"},{text: "Point Light", value: "PointLight"},{text: "Hemisphere Light", value: "HemisphereLight"},{text: "Spot Light", value: "SpotLight"},
    ]},
    lightProperties: {acceptReporters: false, items: [
      {text: "Color", value: "color"},{text: "Intensity", value: "intensity"},{text: "Cast Shadow?", value: "castShadow"},
      {text: "Ground Color (HemisphereLight)", value: "groundColor"},
      {text: "Map (SpotLight)", value: "map"},{text: "Distance (SpotLight)", value: "distance"},{text: "Decay (SpotLight)", value: "decay"},{text: "Penumbra (SpotLight)", value: "penumbra"},{text: "Angle/Size (SpotLight)", value: "angle"},{text: "Power (SpotLight)", value: "power"},
      {text: "Target Position (Directional/SpotLight)", value: "target"},
    ]},
  }
  const utilitiesBlocks = [
    {blockType: Scratch.BlockType.LABEL, text: "Utilities:"},
    {opcode: "newVector2", blockType: Scratch.BlockType.REPORTER, text: "New Vector [X] [Y]", arguments: {X: {type: Scratch.ArgumentType.NUMBER}, Y: {type: Scratch.ArgumentType.NUMBER}}},
    {opcode: "newVector3", blockType: Scratch.BlockType.REPORTER, text: "New Vector [X] [Y] [Z]", arguments: {X: {type: Scratch.ArgumentType.NUMBER}, Y: {type: Scratch.ArgumentType.NUMBER}, Z: {type: Scratch.ArgumentType.NUMBER}}},
    "---",
    {opcode: "operateV3", blockType: Scratch.BlockType.REPORTER, text: "do [V3] [O] [V32]", arguments: {V3: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"}, O: {type: Scratch.ArgumentType.STRING, menu: "operators"}, V32: {type: Scratch.ArgumentType.STRING, defaultValue: "[1,0,0]"}}},
    {opcode: "moveVector3", blockType: Scratch.BlockType.REPORTER, text: "move [S] steps in vector [V3] in direction [D3]", arguments: {S: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1},V3: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"}, D3: {type: Scratch.ArgumentType.STRING, defaultValue: "[1,0,0]"}}},
    {opcode: "directionTo", blockType: Scratch.BlockType.REPORTER, text: "direction from [V3] to [T3]", arguments: {V3: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,3]"}, T3: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,0]"}}},
    "---",
    {opcode: "newColor", extensions: ["colours_looks"], blockType: Scratch.BlockType.REPORTER, text: "New Color [HEX]", arguments: {HEX: {type: Scratch.ArgumentType.COLOR, defaultValue: "#9966ff"}}},
    {opcode: "newFog", extensions: ["colours_looks"], blockType: Scratch.BlockType.REPORTER, text: "New Fog [COLOR] [NEAR] [FAR]", arguments: {COLOR: {type: Scratch.ArgumentType.COLOR, defaultValue: "#9966ff", exemptFromNormalization: true}, NEAR: {type: Scratch.ArgumentType.NUMBER}, FAR: {type: Scratch.ArgumentType.NUMBER, defaultValue: 10}}},
    {opcode: "newTexture", extensions: ["colours_looks"], blockType: Scratch.BlockType.REPORTER, text: "New Texture [COSTUME] [MODE] [STYLE] repeat [X][Y]", arguments: {COSTUME: {type: Scratch.ArgumentType.COSTUME}, MODE: {type: Scratch.ArgumentType.STRING, menu: "textureModes"},STYLE: {type: Scratch.ArgumentType.STRING, menu: "textureStyles"}, X: {type: Scratch.ArgumentType.NUMBER, defaultValue: 1},Y: {type: Scratch.ArgumentType.NUMBER,defaultValue: 1}}},
    {opcode: "newCubeTexture", extensions: ["colours_looks"], blockType: Scratch.BlockType.REPORTER, text: "New Cube Texture X+[COSTUMEX0]X-[COSTUMEX1]Y+[COSTUMEY0]Y-[COSTUMEY1]Z+[COSTUMEZ0]Z-[COSTUMEZ1] [MODE] [STYLE] repeat [X][Y]", arguments: {"COSTUMEX0": {type: Scratch.ArgumentType.COSTUME},"COSTUMEX1": {type: Scratch.ArgumentType.COSTUME},"COSTUMEY0": {type: Scratch.ArgumentType.COSTUME},"COSTUMEY1": {type: Scratch.ArgumentType.COSTUME},"COSTUMEZ0": {type: Scratch.ArgumentType.COSTUME},"COSTUMEZ1": {type: Scratch.ArgumentType.COSTUME}, MODE: {type: Scratch.ArgumentType.STRING, menu: "textureModes"},STYLE: {type: Scratch.ArgumentType.STRING, menu: "textureStyles"}, X: {type: Scratch.ArgumentType.NUMBER,defaultValue: 1},Y: {type: Scratch.ArgumentType.NUMBER,defaultValue: 1}}},
    {opcode: "newEquirectangularTexture", extensions: ["colours_looks"], blockType: Scratch.BlockType.REPORTER, text: "New Equirectangular Texture [COSTUME] [MODE]", arguments: {COSTUME: {type: Scratch.ArgumentType.COSTUME}, MODE: {type: Scratch.ArgumentType.STRING, menu: "textureModes"}}},
    "---",
    {opcode: "curve", extensions: ["colours_data_lists"], blockType: Scratch.BlockType.REPORTER, text: "generate curve [TYPE] from points [POINTS], closed: [CLOSED]", arguments: {TYPE: {type: Scratch.ArgumentType.STRING, menu: "curveTypes"}, POINTS: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,3,0] [2.5,-1.5,0] [-2.5,-1.5,0]"}, CLOSED: {type: Scratch.ArgumentType.STRING, defaultValue: "true"}}},
    "---",
    {opcode: "getItem",extensions: ["colours_data_lists"], blockType: Scratch.BlockType.REPORTER, text: "get item [ITEM] of [ARRAY]", arguments: {ITEM: {type: Scratch.ArgumentType.STRING, defaultValue: "1"}, ARRAY: {type: Scratch.ArgumentType.STRING, defaultValue: `["myObject", "myLight"]`}}},
    {blockType: Scratch.BlockType.LABEL, text: "↳ Raycasting"},
    {opcode: "raycast", blockType: Scratch.BlockType.COMMAND, text: "Raycast from [V3] in direction [D3]", arguments: {V3: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,3]"}, D3: {type: Scratch.ArgumentType.STRING, defaultValue: "[0,0,1]"}}},
    {opcode: "getRaycast", blockType: Scratch.BlockType.REPORTER, text: "get raycast [PROPERTY]", arguments: {PROPERTY: {type: Scratch.ArgumentType.STRING, menu: "raycastProperties"}}},
    {blockType: Scratch.BlockType.LABEL, text: "↳ PointerLock"},
    {opcode: "setLocked", blockType: Scratch.BlockType.COMMAND, text: "set pointer lock [enabled]", arguments: { enabled: { type: Scratch.ArgumentType.STRING, defaultValue: "true", menu: "enabled"}},},
    {opcode: "isLocked", blockType: Scratch.BlockType.BOOLEAN, text: "pointer locked?",},
    "---",
    {opcode:"mouseDown",extensions: ["colours_sensing"], blockType: Scratch.BlockType.BOOLEAN, text: "mouse [BUTTON] [action]?", arguments: {BUTTON: {type: Scratch.ArgumentType.STRING, menu: "mouseButtons"},action: {type: Scratch.ArgumentType.STRING, menu: "mouseAction"}}},
    //{opcode: "mousePos",extensions: ["colours_sensing"], blockType: Scratch.BlockType.REPORTER, text: "mouse position", arguments: {}},
    "---",
    {opcode: "OrbitControl", blockType: Scratch.BlockType.COMMAND, text: "set addon Orbit Control [STATE]", arguments: {STATE: {type: Scratch.ArgumentType.STRING, menu: "enabled"},}},
  ].map(b => typeof b === 'string' ? b : {...b, color1: "#6e7774ff", color2: "#595f5dff", color3: "#5b615fff"})
  const utilitiesMenus = {
    textureModes: {acceptReporters: false, items: ["Pixelate","Blur"]},
    textureStyles: {acceptReporters: false, items: ["Repeat","Clamp"]},
    raycastProperties: {acceptReporters: false, items: [
      {text: "Intersected Object Names", value: "name"},{text: "Number of Objects", value: "number"},{text: "Intersected Objects distances", value: "distance"},
    ]},
    mouseButtons: {acceptReporters: false, items: ["left","middle","right"]},
    mouseAction: {acceptReporters: false, items: ["Down","Clicked"]},
    curveTypes: {acceptReporters: false, items: ["CatmullRomCurve3"]},
    operators: {acceptReporters: false, items: ["+","-","*","/","=","max","min","dot","cross","distance to","angle to","apply euler",]},
    enabled: {acceptReporters: true, items: [{text: "enabled", value: "true"},{text: "disabled", value: "false"}]},
  }

//wait until all packages are loaded
Promise.resolve(load()).then(() => {

  console.log("Extra3D Packages Loaded")

  class extra3D {
    getInfo() {
      return {
        id: "threejsExtension",
        name: "Extra 3D",
        color1: '#555555',
        color2: '#222222',
        
        
        blocks: [
          {blockType: Scratch.BlockType.BUTTON, text: "Show Docs", func: "openDocs"},
          {blockType: Scratch.BlockType.BUTTON, text: "Toggle Alerts", func: "alerts"},
          {opcode: "setRendererRatio", blockType: Scratch.BlockType.COMMAND, text: "set Pixel Ratio to [VALUE]", arguments: {VALUE: {type: Scratch.ArgumentType.NUMBER, defaultValue: "1"}}},
          {opcode: "eulerOrder", blockType: Scratch.BlockType.COMMAND, text: "set euler order to [VALUE]", arguments: {VALUE: {type: Scratch.ArgumentType.STRING, defaultValue: "YXZ"}}},
          ...sceneBlocks,
          ...cameraBlocks,
          ...objectBlocks,
          ...lightBlocks,
          ...utilitiesBlocks,
        ],
        menus: {
          ...sceneMenus,
          ...cameraMenus,
          ...objectMenus,
          ...lightMenus,
          ...utilitiesMenus,
        }
      }
    }
    openDocs(){open("https://civ3ro.github.io/extensions/Documentation/")}
    alerts() {alerts = !alerts; alerts ? alert("Alerts have been enabled!") : alert("Alerts have been disabled!")}
    setRendererRatio(args) {threeRenderer.setPixelRatio(window.devicePixelRatio * args.VALUE)}
    eulerOrder(args) {eulerOrder = args.VALUE}

    //sceneFunctions
    newScene(args) {
      scene = new THREE.Scene();
      scene.name = args.NAME 
      scene.background = new THREE.Color("#222")
      //scene.add(new THREE.GridHelper(16, 16)) //future helper section?

      resetor(0)
    }
    reset() {resetor(1)}
    async setSceneProperty(args) {
      const property = args.PROPERTY;
      const value = getAsset(args.VALUE);

      scene[property] = value;
    }
    getSceneObjects(args) {
      const names = [];
      if (args.THING === "Objects") {
        scene.traverse(obj => {
          if (obj.name) names.push(obj.name); //if it has a name, add to list!
        });
      }
      else if (args.THING === "Materials") return JSON.stringify(Object.keys(materials))
      else if (args.THING === "Geometries") return JSON.stringify(Object.keys(geometries))
      else if (args.THING === "Ligts") return JSON.stringify(Object.keys(lights)) 
      else if (args.THING === "Scene Properties") {console.log(scene); return "check console"}
      else if (args.THING === "Other assets")  return JSON.stringify(assets)

      return JSON.stringify(names); // if objects
    }

    //cameraFunctions
    addCamera(args) {
      let v2 = new THREE.Vector2()
      threeRenderer.getSize(v2)
      const object = new THREE.PerspectiveCamera(90, v2.x / v2.y  )
      object.position.z = 3

      createObject(args.CAMERA, object, args.GROUP)
    }
    setCamera(args) {
      let object = getObject(args.CAMERA)
      object[args.PROPERTY] = args.VALUE
      object.updateProjectionMatrix()
    }
    getCamera(args) {
      let object = getObject(args.CAMERA)
      const value = JSON.stringify(object[args.PROPERTY])
      return value
    }
    renderSceneCamera(args) {
      let object = getObject(args.CAMERA)
      if (!object) return
      camera = object
      //reset composer, else it does not update.
      if (_Extra3D_.COMPOSER) _Extra3D_.resetComposer()
    }
    cubeCamera(args) {
      // Create cube render target
      const cubeRenderTarget = new THREE.WebGLCubeRenderTarget( 256, { generateMipmaps: true } ) 
      // Create cube camera
      const cubeCamera = new THREE.CubeCamera( 0.1, 500, cubeRenderTarget )
      createObject(args.CAMERA, cubeCamera, args.GROUP)

      renderTargets[args.RT] = {target: cubeRenderTarget, camera: cubeCamera}
      assets.renderTargets[cubeRenderTarget.texture.uuid] = cubeRenderTarget.texture
    }
    renderTarget(args) {
      let object = getObject(args.CAMERA)
      const renderTarget = new THREE.WebGLRenderTarget(
        360,
        360,
        {
          generateMipmaps: false
        }
      )

      renderTargets[args.RT] = {target: renderTarget, camera: object}
      assets.renderTargets[renderTarget.texture.uuid] == renderTarget.texture
    }
    sizeTarget(args) {
      renderTargets[args.RT].target.setSize(args.W, args.H)
    }
    getTarget(args) {
      const t = renderTargets[args.RT].target.texture
      console.log(t, renderTargets[args.RT])
      return `renderTargets/${t.uuid}`
    }
    removeTarget(args) {
      delete(assets.renderTargets[renderTargets[args.RT].target.texture.uuid])
      renderTargets[args.RT].target.dispose()
      delete(renderTargets[args.RT])
    }

    //objectFunctions
    addObject(args) {
        const object = new THREE[args.TYPE]();

        object.castShadow = true
        object.receiveShadow = true

        createObject(args.OBJECT3D, object, args.GROUP)
    }
    cloneObject(args) {
      let object = getObject(args.OBJECT3D)
      const clone = object.clone(true)
      clone.name
      createObject(args.NAME, clone, args.GROUP)
    }
    setObjectV3(args) {
        let object = getObject(args.OBJECT3D)
        let values = JSON.parse(args.VALUE)

        function degToRad(deg) {
          return deg * Math.PI / 180;
        }


        if (object.rigidBody) {
          const x = values[0]
          const y = values[1]
          const z = values[2]
          if (args.PROPERTY === "rotation") {
            const euler = new THREE.Euler(
              degToRad(x),
              degToRad(y),
              degToRad(z),
              'YXZ'
            )
            const quaternion = new THREE.Quaternion()
            quaternion.setFromEuler(euler)

            object.rigidBody.setRotation({
              x: quaternion.x,
              y: quaternion.y,
              z: quaternion.z,
              w: quaternion.w
            });
          } else if (args.PROPERTY === "position") {
            object.rigidBody.setTranslation({ x: x, y: y, z: z }, true)
          }
          return
        }

        if (args.PROPERTY === "rotation") {
          values = values.map(v => v * Math.PI / 180);
          object.rotation.set(0,0,0)
        }
        //if (object.isDirectionalLight == true) {object.pos = new THREE.Vector3(...values); console.log(true, values, object.pos); return}
          object[args.PROPERTY].set(...values);

        if (object.type == "CubeCamera") object.updateCoordinateSystem()
    }
    getObjectV3(args) {
        let object = getObject(args.OBJECT3D)
        if (!object) return
        let values = vector3ToString(object[args.PROPERTY])
        if (args.PROPERTY === "rotation") {
          const toDeg = Math.PI/180
          values = [values[0]/toDeg,values[1]/toDeg,values[2]/toDeg,]
        }

        return JSON.stringify(values)
    }
    setObject(args){
      let object = getObject(args.OBJECT3D)
      let value = args.VALUE
      if (args.PROPERTY === "material") {const mat = materials[args.NAME]; if (mat) value = mat; else value = undefined}
      else if (args.PROPERTY === "geometry") {const geo = geometries[args.NAME]; if (geo) value = geo; else value = undefined}
      else value = !!value

      if (value == undefined) return //invalid geo/mat
      object[args.PROPERTY] = value
    }
    getObject(args){
      let object = getObject(args.OBJECT3D)
      if (!object) return
      let value
      if (args.PROPERTY != "visible") value = object[args.PROPERTY].name; 
      else value = object.visible;

      return value
    }
    removeObject(args) {
      removeObject(args.OBJECT3D)
    }
    objectE(args) {
      return scene.children.map(o => o.name).includes(args.NAME)
    }
      //materials
      newMaterial(args) {
        if (materials[args.NAME] && alerts) alert ("material already exists! will replace...")
        const mat = new THREE[args.TYPE]();
        mat.name = args.NAME;

        materials[args.NAME] = mat;
      }
      async setMaterial(args) {
        if (typeof(args.VALUE) == "string" && args.VALUE.at(0) == "|") return
        const mat = materials[args.NAME]

        let value = await args.VALUE

        if (args.VALUE == "false") value = false

        if  (args.PROPERTY == "side") {value = (args.VALUE == "D" ? THREE.DoubleSide : args.VALUE == "B" ? THREE.BackSide : THREE.FrontSide)} 
        else if (args.PROPERTY === "normalScale") value = new THREE.Vector2(...JSON.parse(args.VALUE))
        else value = getAsset(value)
        
        console.log("o:", args.VALUE, typeof(args.VALUE))
        console.log("r:", value, typeof(value))
        
        mat[args.PROPERTY] = (value)
        mat.needsUpdate = true
      }
      setBlending(args) {
        const mat = materials[args.NAME]
        mat.blending = THREE[args.VALUE]
        mat.premultipliedAlpha = true
        mat.needsUpdate = true
      }
      setDepth(args) {
        const mat = materials[args.NAME]
        mat.depthFunc = THREE[args.VALUE]
        mat.needsUpdate = true
      }
      removeMaterial(args){
        const mat = materials[args.NAME]
        mat.dispose()
        delete(materials[args.NAME])
      }
      materialE(args) {
        return materials[args.NAME] ? true : false
      }
      //geometries
      newGeometry(args) {
        if (geometries[args.NAME] && alerts) alert ("geometry already exists! will replace...")
        const geo = new THREE[args.TYPE]()
        geo.name = args.NAME

        geometries[args.NAME] = geo
      }
      setGeometry(args) {
        const geo = geometries[args.NAME]
        geo[args.PROPERTY] = (args.VALUE)

        geo.needsUpdate = true;
      }
      removeGeometry(args){
        const geo = geometries[args.NAME]
        geo.dispose()
        delete(geometries[args.NAME])
      }
      geometryE(args) {
        return geometries[args.NAME] ? true : false
      }
      newGeo(args) {
        const geometry = new THREE.BufferGeometry()
        geometry.name = args.NAME
        geometries[args.NAME] = geometry
      }
      async geoPoints(args) {
        const geometry = geometries[args.NAME]
        const positions = args.POINTS.split(" ").map(v=>JSON.parse(v)).flat() //array of v3 of each vertex of each triangle

        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
        geometry.computeVertexNormals()

        geometry.needsUpdate = true
      }
      geoUVs(args) {
        const geometry = geometries[args.NAME]
        const UVs = args.POINTS.split(" ").map(v=>JSON.parse(v)).flat() //array of v2 of each UV of each triangle

        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(UVs), 2))
        geometry.needsUpdate = true
      }
      splines(args) {
        const geometry = new THREE.TubeGeometry(getAsset(args.CURVE))
        geometry.name = args.NAME

        geometries[args.NAME] = geometry
      }
      async text(args) {
        const fontFile = runtime.getTargetForStage().getSounds().find(c => c.name === args.FONT)
        if (!fontFile) return

        const json = new TextDecoder().decode(fontFile.asset.data.buffer)
        const fontData = JSON.parse(json)

        const font = fontLoad.parse(fontData)

        const params = {font: font, size: JSON.parse(args.S), height: JSON.parse(args.D), curveSegments: JSON.parse(args.CS), bevelEnabled: false}
        const geometry = new TextGeometry.TextGeometry(args.TEXT, params)
        geometry.computeVertexNormals()
        geometry.center() // optional, recenters the text
        

        geometry.name = args.NAME

        geometries[args.NAME] = geometry
      }
      async loadFont() {
        openFileExplorer(".json").then(files => {
          const file = files[0]
          const reader = new FileReader()

          reader.onload = async (e) => {
            const arrayBuffer = e.target.result
            
          // From lily's assets
          // // Thank you PenguinMod for providing this code.
            
              const targetId = runtime.getTargetForStage().id //util.target.id not working!
              const assetName = Cast.toString(file.name)

              const buffer = arrayBuffer

              const storage = runtime.storage
              const asset = storage.createAsset(
                storage.AssetType.Sound,
                storage.DataFormat.MP3,
                // @ts-ignore
                new Uint8Array(buffer),
                null,
                true
              )

              try {
                await vm.addSound(
                  // @ts-ignore
                  {
                    asset,
                    md5: asset.assetId + "." + asset.dataFormat,
                    name: assetName,
                  },
                  targetId
                )
                alert("Font loaded successfully!")
              } catch (e) {
                console.error(e)
                alert("Error loading font.")
              }
            
            // End of PenguinMod
          }

          reader.readAsArrayBuffer(file);
        })
      }
      openConv() {{open("https://gero3.github.io/facetype.js/")}}

    //lightFunctions
    addLight(args) {
      const light = new THREE[args.TYPE](0xffffff, 1)

      createObject(args.NAME, light, args.GROUP)
      lights[args.NAME] = light
      if (light.type === "AmbientLight" || "HemisphereLight") return
      
      light.castShadow = true
      if (light.type === "PointLight") return
      //Directional & Spot Light
      light.target.position.set(0, 0, 0)
      scene.add(light.target)
      
      light.pos = new THREE.Vector3(0,0,0)

      light.shadow.mapSize.width = 4096
      light.shadow.mapSize.height = 2048
      
      if (light.type === "SpotLight") {
      light.decay = 0
      light.shadow.camera.near = 500;
      light.shadow.camera.far = 4000;
      light.shadow.camera.fov = 30;
      }
      light.shadow.needsUpdate = true
      light.needsUpdate = true
    }
    setLight(args) {
      const light = lights[args.NAME]
      if (!args.PROPERTY) return
      if (args.PROPERTY === "target") {
      light.target.position.set(...JSON.parse(args.VALUE)) //vector3
      light.target.updateMatrixWorld();
      }
      else {
        light[args.PROPERTY] = getAsset(args.VALUE)
      }
      light.needsUpdate = true

      if (light.type === "AmbientLight" || "HemisphereLight") return

      light.shadow.camera.updateProjectionMatrix();
      light.shadow.needsUpdate = true
    }

    //utilityFunctions
    mouseDown(args) {
      if (args.action === "Down") return isMouseDown[args.BUTTON]
      if (args.action === "Clicked") {
        if (isMouseDown[args.BUTTON] == prevMouse[args.BUTTON]) return false
        else prevMouse[args.BUTTON] = true; return true
      }
    }
    mousePos() {
      return JSON.stringify(mouseNDC)
    }
    newVector3(args) {
        return JSON.stringify([args.X, args.Y, args.Z])
    }
    operateV3(args){
      const v3 = new THREE.Vector3(...JSON.parse(args.V3))
      const v32 = new THREE.Vector3(...JSON.parse(args.V32))

      let r 
      if (args.O == "+") r = v3.add(v32)
      else if (args.O == "-") r = v3.sub(v32)
      else if (args.O == "*") r = v3.multiply(v32)
      else if (args.O == "/") r = v3.divide(v32)
      else if (args.O == "=") r = v3.equals(v32)
      else if (args.O == "max") r = v3.max(v32)
      else if (args.O == "min") r = v3.min(v32)
      else if (args.O == "dot") r = v3.dot(v32)
      else if (args.O == "cross") r = v3.cross(v32)
      else if (args.O == "distance to") r = v3.distanceTo(v32)
      else if (args.O == "angle to") r = v3.angleTo(v32)
      else if (args.O == "apply euler") r = v3.applyEuler(new THREE.Euler(v32.x, v32.y, v32.z, eulerOrder))

      if (typeof(r) == "object") return JSON.stringify([r.x, r.y, r.z])
      else return JSON.stringify(r)
    }
    newVector2(args) {
      return JSON.stringify([args.X, args.Y])
    }
    moveVector3(args) {
      const currentPos = new THREE.Vector3(...JSON.parse(args.V3));
      const steps = Number(args.S);

      const [pitchInputDeg, yawInputDeg, rollInputDeg] = JSON.parse(args.D3).map(Number);

      const yaw = THREE.MathUtils.degToRad(yawInputDeg); 
      const pitch = THREE.MathUtils.degToRad(pitchInputDeg);
      const roll = THREE.MathUtils.degToRad(rollInputDeg);

      const euler = new THREE.Euler(pitch, yaw, roll, eulerOrder);

      const forwardVector = new THREE.Vector3(0, 0, -1);
      const direction = forwardVector.applyEuler(euler).normalize();

      const newPos = currentPos.add(direction.multiplyScalar(steps));
      return JSON.stringify([newPos.x, newPos.y, newPos.z]);
    }
    directionTo(args) {
      const v3 = new THREE.Vector3(...JSON.parse(args.V3))
      const toV3 = new THREE.Vector3(...JSON.parse(args.T3))

      const direction = toV3.clone().sub(v3).normalize();
      // Pitch (X)
      const pitch = Math.atan2(-direction.y, Math.sqrt(direction.x*direction.x + direction.z*direction.z));
      // Yaw (Y)
      const yaw = Math.atan2(direction.x, direction.z);

      // Roll always 0
      return JSON.stringify([180+THREE.MathUtils.radToDeg(pitch),THREE.MathUtils.radToDeg(yaw),0])
    }
    newColor(args) {
      return args.HEX
    }
    newFog(args) {
      const fog = new THREE.Fog(args.COLOR, args.NEAR, args.FAR)
      const uuid = crypto.randomUUID()
      assets.fogs[uuid] = fog
      return `fogs/${uuid}`
    }
    async newTexture(args) {
      const textureURI = encodeCostume(args.COSTUME)
      const texture = await new THREE.TextureLoader().loadAsync(textureURI);
      texture.name = args.COSTUME

      setTexture(texture, args.MODE, args.STYLE, args.X, args.Y)
      assets.textures[texture.uuid] = texture
      return `textures/${texture.uuid}`
    }
    async newCubeTexture(args) {
      const uris = [encodeCostume(args.COSTUMEX0),encodeCostume(args.COSTUMEX1), encodeCostume(args.COSTUMEY0),encodeCostume(args.COSTUMEY1), encodeCostume(args.COSTUMEZ0),encodeCostume(args.COSTUMEZ1)]
      const normalized = await Promise.all(uris.map(uri => resizeImageToSquare(uri, 256)));
      const texture = await new THREE.CubeTextureLoader().loadAsync(normalized);
      
      texture.name = "CubeTexture" + args.COSTUMEX0;

      console.log(texture, uris, normalized)
      assets.textures[texture.uuid] = texture
      return `textures/${texture.uuid}`
    }
    async newEquirectangularTexture(args) {
      const textureURI = encodeCostume(args.COSTUME)
      const texture = await new THREE.TextureLoader().loadAsync(textureURI);
      texture.name = args.COSTUME
      texture.mapping = THREE.EquirectangularReflectionMapping

      setTexture(texture, args.MODE)
      assets.textures[texture.uuid] = texture
      return `textures/${texture.uuid}`
    }
    curve(args) {
      function parsePoints(input) {
        // Match all [x,y,z] groups
        const matches = input.match(/\[([^\]]+)\]/g)
        if (!matches) return []

        return matches.map(str => {
          const nums = str
            .replace(/[\[\]\s]/g, '')
            .split(',')
            .map(Number)
          return new THREE.Vector3(nums[0] || 0, nums[1] || 0, nums[2] || 0)
        })
      }
      const points = parsePoints(args.POINTS)
      const curve = new THREE[args.TYPE](points)
      curve.closed = JSON.parse(args.CLOSED)

      const uuid = crypto.randomUUID()
      assets.curves[uuid] = curve
      return `curves/${uuid}`
    }
    getItem(args) {
      const items = JSON.parse(args.ARRAY)
      const item = items[args.ITEM - 1]
      if (!item) return "0"
      return item
    }
    raycast(args) {
      const origin = new THREE.Vector3(...JSON.parse(args.V3))
      // rotation is in degrees => convert to radians first
      const rot = JSON.parse(args.D3).map(v => v * Math.PI / 180)

      const euler = new THREE.Euler(rot[0], rot[1], rot[2], eulerOrder)
      const direction = new THREE.Vector3(0, 0, -1).applyEuler(euler).normalize()

      const raycaster = new THREE.Raycaster()
      //const camera = getObject(args.CAMERA)
      raycaster.set( origin, direction );

      const intersects = raycaster.intersectObjects( scene.children, true )

      raycastResult = intersects
    }
    getRaycast(args) {
      if (args.PROPERTY === "number") return raycastResult.length
      if (args.PROPERTY === "distance") return JSON.stringify(raycastResult.map(i => i.distance))
      return JSON.stringify(raycastResult.map(i => i.object[args.PROPERTY]))
    }
      //PointerLock
      setLocked(args) {
      isPointerLockEnabled = Scratch.Cast.toBoolean(args.enabled) === true;
      if (!isPointerLockEnabled && isLocked) {
      document.exitPointerLock();
      }
      }
      isLocked() {
      return isLocked;
      }

    OrbitControl(args) {
      if (controls) controls.dispose()

      controls = new OrbitControls.OrbitControls(camera, threeRenderer.domElement);
      controls.enableDamping = true
      
      controls.enabled = !!args.STATE
    }

  }

  Scratch.extensions.register(new extra3D())

  })
})(Scratch);
