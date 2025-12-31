(async function (Scratch) {
  if (!Scratch.extensions.unsandboxed) {
    throw new Error(`"Dragonian3D" must be run unsandboxed.`);
  }

  const {Cast, BlockType, ArgumentType, vm} = Scratch,
  {runtime} = vm;
  const renderer = runtime.renderer;
  const IN_3D = "THREE.in3d";
  const OBJECT = "THREE.object";
  const THREE_DIRTY = "THREE.dirty";
  const SIDE_MODE = "THREE.sidemode";
  const TEX_FILTER = "THREE.texfilter";
  const Z_POS = "THREE.zpos";
  const Z_STRETCH = "THREE.zstretch";
  const YAW = "THREE.yaw";
  const PITCH = "THREE.pitch";
  const ROLL = "THREE.roll";
  const ATTACHED_TO = "THREE.attachedto";
  const LIGHT_DEP = "THREE.lightdep";
  const MATERIAL_NAME = "THREE.matname";

  let Engine = "Turbowarp";

  if (Scratch.extensions.isUSB) {
      Engine = "UnSandBoxed";
  } else if (Scratch.extensions.isPenguinMod) {
      Engine = "PenguinMod";
  } else if (Scratch.extensions.isNitroBolt) {
      Engine = "NitroBolt";
  }

  console.log(`Current engine is "${Engine}`);

  const extcolors = {
    Three: ["#0000ff", "#0000cc", "#0000ff"], 
    Motion: ["#4C97FF", "#3a7ae0", "#0000ff"],
    Looks: ["#9966FF", "#7a52cc", "#0000ff"],
    Lighting: ["#dcbc48ff", "#f3d051ff", "#0000ff"],
    Sound: ["#CF63CF", "#b74fb7", "#0000ff"],
    Events: ["#FFBF00", "#e0a800", "#0000ff"],
    Control: ["#FFAB19", "#e09900", "#0000ff"],
    Sensing: ["#5CB1D6", "#4a9bc2", "#0000ff"],
    Camera: ["#da9672", "#702b00", "#0000ff"],
    Operators: ["#59C059", "#47a847", "#0000ff"],
    Pen: ["#0FBD8C", "#0da57a", "#0000ff"],
  };

  const extimages = {};
  const extsounds = {};

  try {
    const threeModule = await import('https://esm.sh/three@0.180.0');
    window.THREE = threeModule;

    const { OrbitControls } = await import('https://esm.sh/three@0.180.0/examples/jsm/controls/OrbitControls.js');
    const { GLTFLoader } = await import('https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js');
    const { OBJLoader } = await import('https://esm.sh/three@0.180.0/examples/jsm/loaders/OBJLoader.js');
    const { SVGLoader } = await import('https://esm.sh/three@0.180.0/examples/jsm/loaders/SVGLoader.js');
    const { SVGRenderer, SVGObject } = await import('https://esm.sh/three@0.180.0/examples/jsm/renderers/SVGRenderer.js');
    
    THREE.OrbitControls = OrbitControls;
    THREE.GLTFLoader = GLTFLoader;
    THREE.OBJLoader = OBJLoader;
    THREE.SVGLoader = SVGLoader;
    THREE.SVGRenderer = SVGRenderer;
    THREE.SVGObject = SVGObject;

    console.log('Three.js initialized:', THREE);
    
  } catch (error) {
    console.error('Initialization failed:', error);
    throw new Error('Three.js failed to initialize');
  }

  let is3DInitialized = false;
  let is3DHidden = false;
  let currentSprite = null;
  const spriteObjects = {};
  const modelObjects = {};
  const loadedModels = {};
  const loadedMaterials = {};
  
  const lights = {};
  let lightCounter = 0;
  
  let scene = null;
  let cameras = {};
  let activeCamera = null;
  let threeRenderer = null;
  let threeSkinId = null;
  let threeSkin = null;
  let threeDrawableId = null;
  let stampRenderTarget = null;
  let raycaster = null;
  let stageSizeEvent = null;

  const PATCHES_ID = "__patches" + "Dragonian3D";
  const patch = (obj, functions) => {
    if (obj[PATCHES_ID]) return;
    obj[PATCHES_ID] = {};
    for (const name in functions) {
      const original = obj[name];
      obj[PATCHES_ID][name] = obj[name];
      if (original) {
        obj[name] = function(...args) {
          const callOriginal = (...ogArgs) => original.call(this, ...ogArgs);
          return functions[name].call(this, callOriginal, ...args);
        };
      } else {
        obj[name] = function (...args) {
          return functions[name].call(this, () => {}, ...args);
        }
      }
    }
  }
  const _unpatch = (obj) => {
    if (!obj[PATCHES_ID]) return;
    for (const name in obj[PATCHES_ID]) {
      obj[name] = obj[PATCHES_ID][name];
    }
    delete obj[PATCHES_ID];
  }

  const Skin = renderer.exports.Skin;

  class SimpleSkin extends Skin {
    constructor(id, renderer) {
      super(id, renderer);
      const gl = renderer.gl;
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      this._texture = texture;
      this._rotationCenter = [240, 180];
      this._size = [480, 360];
    }
    dispose() {
      if (this._texture) {
        this._renderer.gl.deleteTexture(this._texture);
        this._texture = null;
      }
      super.dispose();
    }
    set size(value) {
      this._size = value;
      this._rotationCenter = [value[0] / 2, value[1] / 2];
    }
    get size() {
      return this._size;
    }
    getTexture(scale) {
      return this._texture || super.getTexture(scale);
    }
    setContent(textureData) {
      const gl = this._renderer.gl;
      gl.bindTexture(gl.TEXTURE_2D, this._texture);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        textureData
      );
      this.emitWasAltered();
    }
  }

  function getCanvasFromTexture(gl, texture, width, height) {
    const framebuffer = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const data = new Uint8Array(width * height * 4);
    gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, data);

    gl.deleteFramebuffer(framebuffer);

    const imageData = new ImageData(width, height);
    imageData.data.set(data);

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");

    context.putImageData(imageData, 0, 0);

    return canvas;
  }

  function getCanvasFromSkin(skin) {
    const emptyCanvas = () => {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      return canvas;
    }

    switch (skin.constructor) {
      case renderer.exports.BitmapSkin: {
        if (skin._textureSize[0] < 1 || skin._textureSize[1] < 1)
          return emptyCanvas();
        return getCanvasFromTexture(
          renderer.gl,
          skin.getTexture(),
          skin._textureSize[0],
          skin._textureSize[1]
        );
      }
      case renderer.exports.SVGSkin: {
        const INDEX_OFFSET = 8;
        const textureScale = 200;

        const scaleMax = textureScale ? Math.max(Math.abs(textureScale), Math.abs(textureScale)) : 100;
        const requestedScale = Math.min(scaleMax / 100, skin._maxTextureScale);
        const mipLevel = Math.max(Math.ceil(Math.log2(requestedScale)) + INDEX_OFFSET, 0);
        const mipScale = Math.pow(2, mipLevel - INDEX_OFFSET);

        const sizeX = Math.ceil(skin._size[0] * mipScale);
        const sizeY = Math.ceil(skin._size[1] * mipScale)
        if (sizeX < 1 || sizeY < 1)
          return emptyCanvas();

        return getCanvasFromTexture(
          renderer.gl,
          skin.getTexture([textureScale, textureScale]),
          sizeX,
          sizeY
        );
      }
      default:
        console.error("Could not get skin image data:", skin);
        throw new TypeError("Could not get skin image data");
    }
  }

  function getSizeFromSkin(skin) {
    switch (skin.constructor) {
      case renderer.exports.BitmapSkin: {
        return [
          skin._textureSize[0],
          skin._textureSize[1]
        ];
      }
      case renderer.exports.SVGSkin: {
        return skin._size;
      }
      default:
        console.error("Could not get skin size:", skin);
        throw new TypeError("Could not get skin size");
    }
  }

  function getThreeTextureFromSkin(skin) {
    if (skin._3dCachedTexture) return skin._3dCachedTexture;
    
    if (skin.constructor === renderer.exports.SVGSkin) {
      try {
        const svgString = skin._svgString || skin._svgData;
        if (svgString) {
          const loader = new THREE.SVGLoader();
          const data = loader.parse(svgString);
          
          if (data && data.paths && data.paths.length > 0) {

            const group = new THREE.Group();
            const materials = [];
            
            data.paths.forEach((path, index) => {
              const shapes = path.toShapes(true);
              
              shapes.forEach(shape => {

                const geometry = new THREE.ExtrudeGeometry(shape, {
                  depth: 1,
                  bevelEnabled: false
                });
                

                const material = new THREE.MeshStandardMaterial({
                  color: path.color || 0xffffff,
                  side: THREE.DoubleSide,
                  metalness: 0.1,
                  roughness: 0.5
                });
                

                const mesh = new THREE.Mesh(geometry, material);
                group.add(mesh);
                
                materials.push(material);
              });
            });
            

            const canvas = getCanvasFromSkin(skin);
            const texture = new THREE.CanvasTexture(canvas);
            texture.colorSpace = THREE.SRGBColorSpace;
            

            skin._3dSvgGroup = group;
            skin._3dSvgMaterials = materials;
            
            return texture;
          }
        }
      } catch (e) {
        console.error("Error processing SVG with SVGLoader:", e);
      }
    }
    

    skin._3dCachedTexture = new THREE.CanvasTexture(getCanvasFromSkin(skin));
    skin._3dCachedTexture.colorSpace = THREE.SRGBColorSpace;
    return skin._3dCachedTexture;
  }

  function initialize3D() {
    if (is3DInitialized) return;
    
    scene = new THREE.Scene();
    
    threeRenderer = new THREE.WebGLRenderer({ preserveDrawingBuffer: true });
    threeRenderer.setClearColor(0x000000, 0);
    threeRenderer.setSize(480, 360);
    
    threeSkinId = renderer._nextSkinId++;
    threeSkin = new SimpleSkin(threeSkinId, renderer);
    renderer._allSkins[threeSkinId] = threeSkin;
    threeDrawableId = renderer.createDrawable("pen");
    renderer._allDrawables[threeDrawableId].customDrawableName = "3D Layer";
    renderer.updateDrawableSkinId(threeDrawableId, threeSkinId);
    
    stampRenderTarget = new THREE.WebGLRenderTarget(480, 360);
    raycaster = new THREE.Raycaster();
    
    stageSizeEvent = () => updateScale();
    vm.on("STAGE_SIZE_CHANGED", stageSizeEvent);
    
    scene.background = new THREE.Color(0x000000);
    
    createDefaultCamera();
    

    THREE.Materials = {
      basic: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.5,
        metalness: 0.0,
        side: THREE.DoubleSide
      }),
      glow: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        emissive: 0xffffff,
        emissiveIntensity: 0.2,
        roughness: 0.2,
        metalness: 0.8,
        side: THREE.DoubleSide
      }),
      rocky: new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.9,
        metalness: 0.1,
        side: THREE.DoubleSide
      })
    };
    
    is3DInitialized = true;
    is3DHidden = false;
    updateScale();
  }

  function createDefaultCamera() {
    const defaultCamera = new THREE.PerspectiveCamera(75, 480/360, 0.1, 10000);
    defaultCamera.name = "camera";
    defaultCamera.position.set(0, 0, 5);
    defaultCamera.lookAt(0, 0, 0);
    
    defaultCamera.userData = {
      attachedTo: null,
      attachmentType: null,
      positionalOffset: new THREE.Vector3(0, 0, 0),
      rotationalOffset: new THREE.Euler(0, 0, 0, 'YXZ'),
      originalPosition: defaultCamera.position.clone(),
      originalRotation: defaultCamera.rotation.clone()
    };
    
    cameras["camera"] = defaultCamera;
    activeCamera = defaultCamera;
    
    updateRenderer();
  }

  function createCamera(name, type = "perspective") {
    if (!is3DInitialized) initialize3D();
    
    if (cameras[name]) {
      console.warn(`Camera "${name}" already exists`);
      return cameras[name];
    }
    
    let newCamera;
    if (type === "orthographic") {
      const aspect = 480 / 360;
      const frustumSize = 10;
      newCamera = new THREE.OrthographicCamera(
        -frustumSize * aspect / 2,
        frustumSize * aspect / 2,
        frustumSize / 2,
        -frustumSize / 2,
        0.1,
        10000
      );
    } else {
      newCamera = new THREE.PerspectiveCamera(75, 480/360, 0.1, 10000);
    }
    
    newCamera.name = name;
    newCamera.position.set(0, 0, 5);
    newCamera.lookAt(0, 0, 0);
    
    newCamera.userData = {
      attachedTo: null,
      attachmentType: null,
      positionalOffset: new THREE.Vector3(0, 0, 0),
      rotationalOffset: new THREE.Euler(0, 0, 0, 'YXZ'),
      originalPosition: newCamera.position.clone(),
      originalRotation: newCamera.rotation.clone(),
      type: type
    };
    
    cameras[name] = newCamera;
    
    updateRenderer();
    return newCamera;
  }
  
  function deleteCamera(name) {
    if (name === "camera") {
      console.warn("Cannot delete default camera");
      return;
    }
    
    if (!cameras[name]) {
      console.warn(`Camera "${name}" does not exist`);
      return;
    }
    
    if (activeCamera === cameras[name]) {
      activeCamera = cameras["camera"];
    }
    
    delete cameras[name];
    updateRenderer();
  }

  function updateAttachedCameras() {
    for (const cameraName in cameras) {
      const camera = cameras[cameraName];
      const cameraData = camera.userData;
      
      if (cameraData.attachedTo && cameraData.attachmentType) {
        const target = runtime.getSpriteTargetByName(cameraData.attachedTo);
        if (!target) continue;
        
        const dr = renderer._allDrawables[target.drawableID];
        if (!dr) continue;
        
        const spritePos = new THREE.Vector3(target.x, target.y, dr[Z_POS] || 0);
        const spriteRot = new THREE.Euler(
          dr[PITCH] || 0,
          dr[YAW] || 0,
          dr[ROLL] || 0,
          'YXZ'
        );
        
        if (cameraData.attachmentType === "positional" || cameraData.attachmentType === "both") {
          const offsetPos = spritePos.clone().add(cameraData.positionalOffset);
          camera.position.copy(offsetPos);
        }
        
        if (cameraData.attachmentType === "rotational" || cameraData.attachmentType === "both") {
          const offsetRot = new THREE.Euler(
            spriteRot.x + cameraData.rotationalOffset.x,
            spriteRot.y + cameraData.rotationalOffset.y,
            spriteRot.z + cameraData.rotationalOffset.z,
            'YXZ'
          );
          camera.rotation.copy(offsetRot);
        }
      }
    }
  }

  function updateAttachedLights() {
    for (const lightName in lights) {
      const lightData = lights[lightName];
      
      if (lightData.attachedTo) {
        const target = runtime.getSpriteTargetByName(lightData.attachedTo);
        if (!target) continue;
        
        const dr = renderer._allDrawables[target.drawableID];
        if (!dr) continue;
        
        const spritePos = new THREE.Vector3(target.x, target.y, dr[Z_POS] || 0);
        const spriteRot = new THREE.Euler(
          dr[PITCH] || 0,
          dr[YAW] || 0,
          dr[ROLL] || 0,
          'YXZ'
        );
        
        if (lightData.attachmentType === "positional" || lightData.attachmentType === "both") {
          const offsetPos = spritePos.clone().add(lightData.positionalOffset);
          lightData.light.position.copy(offsetPos);
        }
        
        if (lightData.attachmentType === "rotational" || lightData.attachmentType === "both") {
          const offsetRot = new THREE.Euler(
            spriteRot.x + lightData.rotationalOffset.x,
            spriteRot.y + lightData.rotationalOffset.y,
            spriteRot.z + lightData.rotationalOffset.z,
            'YXZ'
          );
          lightData.light.rotation.copy(offsetRot);
          
          if (lightData.light.target) {
            lightData.light.target.position.copy(spritePos);
            lightData.light.target.rotation.copy(offsetRot);
          }
        }
      }
    }
  }

  function uninitialize3D() {
    if (!is3DInitialized) return;
    
    for (const dr of renderer._allDrawables) {
      if (!dr) continue;
      disable3DForDrawable(dr.id);
      delete dr[IN_3D];
      delete dr[OBJECT];
    }
    
    for (const cameraName in cameras) {
      deleteCamera(cameraName);
    }
    cameras = {};
    activeCamera = null;
    
    for (const lightId in lights) {
      if (lights[lightId] && lights[lightId].light) {
        scene.remove(lights[lightId].light);
        if (lights[lightId].light.dispose) lights[lightId].light.dispose();
        if (lights[lightId].light.target) {
          scene.remove(lights[lightId].light.target);
        }
      }
    }
    lights = {};
    lightCounter = 0;
    
    if (scene) scene.clear();
    scene = null;
    
    if (threeRenderer) threeRenderer.dispose();
    threeRenderer = null;
    
    if (threeSkinId) threeSkin.dispose();
    threeSkinId = null;
    threeSkin = null;
    
    if (threeDrawableId) renderer._allDrawables[threeDrawableId].dispose();
    threeDrawableId = null;
    
    if (stageSizeEvent) vm.off("STAGE_SIZE_CHANGED", stageSizeEvent);
    stageSizeEvent = null;
    
    if (stampRenderTarget) stampRenderTarget.dispose();
    stampRenderTarget = null;
    
    is3DInitialized = false;
    is3DHidden = false;
  }

  function updateScale() {
    if (!is3DInitialized) return;
    
    const w = runtime.stageWidth || 480;
    const h = runtime.stageHeight || 360;
    
    threeSkin.size = [w, h];
    
    for (const cameraName in cameras) {
      const camera = cameras[cameraName];
      if (camera.isPerspectiveCamera) {
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      } else if (camera.isOrthographicCamera) {
        const aspect = w / h;
        const frustumSize = 10;
        camera.left = -frustumSize * aspect / 2;
        camera.right = frustumSize * aspect / 2;
        camera.top = frustumSize / 2;
        camera.bottom = -frustumSize / 2;
        camera.updateProjectionMatrix();
      }
    }
    
    threeRenderer.setSize(w, h);
    stampRenderTarget.setSize(w, h);
    
    updateRenderer();
  }

  function updateRenderer() {
    if (!is3DInitialized) return;
    renderer[THREE_DIRTY] = true;
    runtime.requestRedraw();
  }

  function doUpdateRenderer() {
    if (!is3DInitialized || !activeCamera) return;
    
    updateAttachedCameras();
    updateAttachedLights();
    
    threeRenderer.render(scene, activeCamera);
    
    if (!threeSkinId) return;
    threeSkin.setContent(threeRenderer.domElement);
  }

  function enable3DForDrawable(drawableID, type = "flat") {
    if (!is3DInitialized) return;
    
    const dr = renderer._allDrawables[drawableID];
    if (dr[IN_3D]) return;
    
    dr[IN_3D] = true;
    dr._3dMode = type;
    dr._flatLayers = 1;
    
    let obj;
    if (type === "model") {
      obj = new THREE.Group();
    } else if (type === "sprite") {
      obj = new THREE.Sprite();
    } else {
      obj = new THREE.Mesh();
    }
    dr[OBJECT] = obj;
    updateMeshForDrawable(drawableID, type);
    
    if (!(YAW in dr)) dr[YAW] = 0;
    if (!(PITCH in dr)) dr[PITCH] = 0;
    if (!(ROLL in dr)) dr[ROLL] = 0;
    if (!(Z_POS in dr)) dr[Z_POS] = 0;
    
    if (!(LIGHT_DEP in dr)) dr[LIGHT_DEP] = "lid";
    
    scene.add(obj);
    updateRenderer();
  }

  function updateMeshForDrawable(drawableID, type) {
    const dr = renderer._allDrawables[drawableID];
    if (!dr[IN_3D]) return;
    const obj = dr[OBJECT];
    
    if (obj.isSprite) {
      if (obj.material) obj.material.dispose();
      obj.material = new THREE.SpriteMaterial();
      try {
        const size = getSizeFromSkin(dr.skin);
        obj._sizeX = size[0];
        obj._sizeY = size[1];
        obj._sizeZ = size[0];
      } catch (e) {
        console.error(e);
        obj._sizeX = 0;
        obj._sizeY = 0;
        obj._sizeZ = 0;
      }
    } else if (type === "model") {
      if (obj.children.length === 0) {
        obj._sizeX = 1;
        obj._sizeY = 1;
        obj._sizeZ = 1;
      }
    } else {
      const isLD = dr[LIGHT_DEP] === "ld";
      const materialType = isLD ? THREE.MeshLambertMaterial : THREE.MeshBasicMaterial;
      obj.material = new materialType();
      switch (type) {
        case "flat":
          obj.geometry = new THREE.PlaneGeometry(dr.skin.size[0], dr.skin.size[1], 1, dr._flatLayers || 1);
          break;
        case "flat triangle": {
          const geometry = new THREE.BufferGeometry();
          const w = dr.skin.size[0] / 2;
          const h = dr.skin.size[1] / 2;
          
          const vertices = new Float32Array([
            -w, -h, 0.0,
            w, -h, 0.0,
            -w, h, 0.0,
          ]);
          const uvs = new Float32Array([
            0, 0,
            1, 0,
            0, 1
          ]);
          geometry.setIndex([0, 1, 2]);
          geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
          geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
          obj.geometry = geometry;
        } break;
        case "cube":
          obj.geometry = new THREE.BoxGeometry(dr.skin.size[0], dr.skin.size[1], dr.skin.size[0]);
          break;
        case "sphere":
          obj.geometry = new THREE.SphereGeometry(Math.max(dr.skin.size[0], dr.skin.size[1]) / 2, 24, 12);
          break;
        case "low-poly sphere":
          obj.geometry = new THREE.SphereGeometry(Math.max(dr.skin.size[0], dr.skin.size[1]) / 2, 8, 6);
          break;
      }
      obj._sizeX = 1;
      obj._sizeY = 1;
      obj._sizeZ = 1;
    }
    
    if (type !== "model") {
      const texture = getThreeTextureFromSkin(dr.skin);
      if (obj.material) {
        obj.material.map = texture;
        texture.colorSpace = THREE.SRGBColorSpace;
        obj.material.alphaTest = 0.01;
        obj.material.needsUpdate = true;
      }
    }
    
    updateMaterialForDrawable(drawableID);
    
    if (dr.updateScale) {
      dr.updateScale(dr.scale);
    }
  }

  function updateMaterialForDrawable(drawableID) {
    const dr = renderer._allDrawables[drawableID];
    if (!dr[IN_3D]) return;
    const obj = dr[OBJECT];
    
    if (!(SIDE_MODE in dr)) dr[SIDE_MODE] = THREE.DoubleSide;
    if (!(TEX_FILTER in dr)) dr[TEX_FILTER] = THREE.LinearMipmapLinearFilter;
    
    if (obj.isGroup && dr._3dMode === "model") {
      obj.traverse(child => {
        if (child.isMesh) {
          child.material.side = dr[SIDE_MODE];
          if (child.material.map) {
            const texture = child.material.map;
            texture.minFilter = dr[TEX_FILTER];
            texture.magFilter = dr[TEX_FILTER];
            if (texture.magFilter === THREE.LinearMipmapLinearFilter)
              texture.magFilter = THREE.LinearFilter;
            texture.needsUpdate = true;
          }
          child.material.transparent = true;
          child.material.needsUpdate = true;
        }
      });
    } else if (obj.material) {
      obj.material.side = dr[SIDE_MODE];
      
      if (obj.material.map) {
        const texture = obj.material.map;
        texture.minFilter = dr[TEX_FILTER];
        texture.magFilter = dr[TEX_FILTER];
        if (texture.magFilter === THREE.LinearMipmapLinearFilter)
          texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
      }
      
      obj.material.transparent = true;
      obj.material.needsUpdate = true;
    }
  }

  function disable3DForDrawable(drawableID) {
    const dr = renderer._allDrawables[drawableID];
    if (!dr[IN_3D]) return;
    
    dr[IN_3D] = false;
    dr._3dMode = "disabled";
    
    if (dr[OBJECT]) {
      dr[Z_POS] = dr[OBJECT].position.z;
      delete dr[Z_STRETCH];
      
      dr[OBJECT].removeFromParent();
      if (dr[OBJECT].material) {
        dr[OBJECT].material.dispose();
        if (dr[OBJECT].material.map) dr[OBJECT].material.map.dispose();
      }
      if (dr[OBJECT].geometry) dr[OBJECT].geometry.dispose();
      dr[OBJECT] = null;
    }
    updateRenderer();
  }

  async function loadModel(name, url, type) {
    if (loadedModels[name]) {
      console.warn(`Model "${name}" already loaded`);
      return loadedModels[name];
    }
    
    try {
      let model;
      if (type === "GLTF") {
        const loader = new THREE.GLTFLoader();
        const gltf = await loader.loadAsync(url);
        model = gltf.scene;
      } else if (type === "OBJ") {
        const loader = new THREE.OBJLoader();
        model = await loader.loadAsync(url);
      } else {
        throw new Error(`Unsupported model type: ${type}`);
      }
      

      model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          

          if (child.material) {
            const materialName = name + "_material_" + Math.random().toString(36).substring(2, 9);
            loadedMaterials[materialName] = child.material.clone();
          }
        }
      });
      
      loadedModels[name] = model;
      return model;
    } catch (error) {
      console.error(`Failed to load model "${name}":`, error);
      throw error;
    }
  }

  function getAllLists() {
    const lists = [];
    const stage = Scratch.vm.runtime.getTargetForStage();
    const sprites = Scratch.vm.runtime.targets;

    for (const target of sprites) {
      const targetLists = Object.values(target.variables).filter(
        variable => variable.type === 'list'
      );
      for (const list of targetLists) {
        if (!lists.includes(list.name)) {
          lists.push(list.name);
        }
      }
    }

    return lists;
  }

  function applyPatches() {
    const Drawable = renderer.exports.Drawable;
    
    patch(Drawable.prototype, {
      getVisible(og) {
        if (this[IN_3D]) return false;
        return og();
      },
      updateVisible(og, value) {
        if (this[IN_3D]) {
          const o = this[OBJECT];
          if (o.visible !== value) {
            o.visible = value;
            updateRenderer();
          }
        }
        return og(value);
      },
      updatePosition(og, position) {
        if (this[IN_3D]) {
          const o = this[OBJECT];
          o.position.x = position[0];
          o.position.y = position[1];
          updateRenderer();
        }
        return og(position);
      },
      updateDirection(og, direction) {
        if (this[IN_3D]) {
          this[YAW] = THREE.MathUtils.degToRad(direction);
          updateRenderer();
        }
        return og(direction);
      },
      updateScale(og, scale) {
        if (this[IN_3D]) {
          const obj = this[OBJECT];
          obj.scale.x = (obj._sizeX ?? 100) / 100 * scale[0];
          obj.scale.y = (obj._sizeY ?? 100) / 100 * scale[1];
          obj.scale.z = (obj._sizeZ ?? 100) / 100 * (this[Z_STRETCH] ?? scale[0]);
          updateRenderer();
        }
        return og(scale);
      },
      dispose(og) {
        if (this[OBJECT]) {
          this[OBJECT].removeFromParent();
          if (this[OBJECT].material) {
            this[OBJECT].material.dispose();
            if (this[OBJECT].material.map) this[OBJECT].material.map.dispose();
          }
          if (this[OBJECT].geometry) this[OBJECT].geometry.dispose();
          this[OBJECT] = null;
          updateRenderer();
        }
        return og();
      },
      _skinWasAltered(og) {
        og();
        if (this[IN_3D]) {
          updateRenderer();
        }
      }
    });
    
    patch(renderer, {
      draw(og) {
        if (this[THREE_DIRTY]) {
          doUpdateRenderer();
          this[THREE_DIRTY] = false;
        }
        return og();
      },
    });
  }

  applyPatches();


  const pen3DState = {
    isDown: false,
    color: '#000000',
    size: 1,
    material: 'basic',
    shade: 50,
    transparency: 100,
    brush: 'brush'
  };

  class ThreeBase {
    constructor() {
      this.scene = null;
    }

    getInfo() {
      return {
        id: 'Dragonian3D',
        name: '3D',
        color1: extcolors.Three[0],
        color2: extcolors.Three[1],
        color3: extcolors.Three[2],
        blocks: [
          {
            opcode: "is3DOn",
            blockType: BlockType.BOOLEAN,
            text: "3D on?",
          },
          {
            opcode: "set3DEnabled",
            blockType: BlockType.COMMAND,
            text: "set 3D to [ENABLED]",
            arguments: {
              ENABLED: { 
                type: ArgumentType.STRING,
                menu: 'onOffMenu',
                defaultValue: 'ON'
              },
            },
          },
          {
            opcode: "get3DEnabled",
            blockType: BlockType.REPORTER,
            text: "3D enabled",
          },
          {
            opcode: "get3DView",
            blockType: BlockType.REPORTER,
            text: "3D view",
          },
          '---',
          {
            opcode: "setSkyboxColor",
            blockType: BlockType.COMMAND,
            text: "set skybox to color [COLOR]",
            arguments: {
              COLOR: { 
                type: ArgumentType.COLOR, 
                defaultValue: "#ffffff" 
              },
            },
          },
          {
            opcode: "getSkyboxColor",
            blockType: BlockType.REPORTER,
            text: "skybox color",
          },
        ],
        menus: {
          onOffMenu: {
            acceptReporters: true,
            items: ['on', 'off', 'hide']
          },
          spriteMenu: {
            acceptReporters: true,
            items: "getSprites",
          },
        },
      };
    }

    is3DOn() {
      return is3DInitialized && !is3DHidden;
    }

    set3DEnabled(args) {
      const enabled = Cast.toString(args.ENABLED).toLowerCase();
      
      if (enabled === 'on') {
        if (!is3DInitialized) {
          initialize3D();
        } else if (is3DHidden) {
          is3DHidden = false;
          updateRenderer();
        }
      } else if (enabled === 'off') {
        if (is3DInitialized) {
          uninitialize3D();
        }
      } else if (enabled === 'hide') {
        if (is3DInitialized && !is3DHidden) {
          is3DHidden = true;
          updateRenderer();
        }
      }
    }

    get3DEnabled() {
      if (!is3DInitialized) return "off";
      if (is3DHidden) return "hide";
      return "on";
    }

    get3DView() {
      if (!is3DInitialized || is3DHidden) return "";
      

      threeRenderer.render(scene, activeCamera);
      
      return threeRenderer.domElement.toDataURL('image/png');
    }

    setSkyboxColor(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const color = new THREE.Color(Cast.toString(args.COLOR));
      scene.background = color;
      updateRenderer();
    }

    getSkyboxColor() {
      if (!is3DInitialized || is3DHidden || !scene.background) return "#000000";
      
      if (scene.background.isColor) {
        return '#' + scene.background.getHexString();
      }
      return "#000000";
    }

    getSprites() {
      const spriteNames = [{ text: "myself", value: "myself" }];
      const targets = runtime.targets;
      for (let index = 1; index < targets.length; index++) {
        const target = targets[index];
        if (target.isOriginal && target.sprite) {
          spriteNames.push({
            text: target.sprite.name,
            value: target.sprite.name
          });
        }
      }
      return spriteNames.length > 1 ? spriteNames : [{ text: "myself", value: "myself" }];
    }
  }

class ThreeMotion {
  constructor() {}

  getInfo() {
    return {
      id: 'Dragonian3DMotion',
      name: 'Motion 3D',
      color1: extcolors.Motion[0],
      color2: extcolors.Motion[1],
      color3: extcolors.Motion[2],
      blocks: [
        {
          opcode: "moveSteps",
          blockType: BlockType.COMMAND,
          text: "move [STEPS] steps in 3D",
          arguments: {
            STEPS: { type: ArgumentType.NUMBER, defaultValue: 10 },
          },
        },
        {
          opcode: "setPosition",
          blockType: BlockType.COMMAND,
          text: "set position to x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "xPosition",
          blockType: BlockType.REPORTER,
          text: "x position",
        },
        {
          opcode: "yPosition",
          blockType: BlockType.REPORTER,
          text: "y position",
        },
        {
          opcode: "zPosition",
          blockType: BlockType.REPORTER,
          text: "z position",
        },
        {
          opcode: "changePosition",
          blockType: BlockType.COMMAND,
          text: "change position by x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "setRotation",
          blockType: BlockType.COMMAND,
          text: "set rotation to r:[R] p:[P] y:[Y]",
          arguments: {
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "roll",
          blockType: BlockType.REPORTER,
          text: "roll",
        },
        {
          opcode: "pitch",
          blockType: BlockType.REPORTER,
          text: "pitch",
        },
        {
          opcode: "yaw",
          blockType: BlockType.REPORTER,
          text: "yaw",
        },
        {
          opcode: "changeRotation",
          blockType: BlockType.COMMAND,
          text: "change rotation by r:[R] p:[P] y:[Y]",
          arguments: {
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "setPosMenu",
          blockType: BlockType.COMMAND,
          text: "set pos [POSTYPES] to [NUMBER]",
          arguments: {
            POSTYPES: { type: ArgumentType.STRING, menu: "postypes", defaultValue: "x" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "setRotMenu",
          blockType: BlockType.COMMAND,
          text: "set rot [ROTTYPES] to [NUMBER]",
          arguments: {
            ROTTYPES: { type: ArgumentType.STRING, menu: "rottypes", defaultValue: "roll" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "directionAround",
          blockType: BlockType.REPORTER,
          text: "direction around [ROTTYPES]",
          arguments: {
            ROTTYPES: { type: ArgumentType.STRING, menu: "rottypes", defaultValue: "roll" },
          },
        },
        {
          opcode: "position",
          blockType: BlockType.REPORTER,
          text: "position as [TYPE]",
          arguments: {
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "rotation",
          blockType: BlockType.REPORTER,
          text: "rotation as [TYPE]",
          arguments: {
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "turnDegrees",
          blockType: BlockType.COMMAND,
          text: "turn [TURNDIRS] [NUM] degrees",
          arguments: {
            TURNDIRS: { type: ArgumentType.STRING, menu: "turndirs", defaultValue: "up" },
            NUM: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "direction",
          blockType: BlockType.REPORTER,
          text: "direction",
        },
      ],
      menus: {
        postypes: {
          acceptReporters: true,
          items: ["x", "y", "z"],
        },
        rottypes: {
          acceptReporters: true,
          items: [{ text: "roll", value: "roll" }, { text: "pitch", value: "pitch" }, { text: "yaw", value: "yaw" }],
        },
        turndirs: {
          acceptReporters: true,
          items: ["up", "down", "left", "right"],
        },
        dataTypeMenu: {
          acceptReporters: true,
          items: [{ text: "array", value: "array" }, { text: "object", value: "object" }]
        }
      },
    };
  }

  moveSteps(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const steps = Cast.toNumber(args.STEPS);
    const angle = util.target.direction * Math.PI / 180;
    const dx = Math.sin(angle) * steps;
    const dy = -Math.cos(angle) * steps;
    
    util.target.setXY(util.target.x + dx, util.target.y + dy);
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (dr[IN_3D] && dr[OBJECT]) {
      dr[OBJECT].position.x = util.target.x;
      dr[OBJECT].position.y = util.target.y;
      updateRenderer();
    }
  }

  setPosition(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    util.target.setXY(x, y);
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (dr[IN_3D] && dr[OBJECT]) {
      dr[OBJECT].position.x = x;
      dr[OBJECT].position.y = y;
      dr[OBJECT].position.z = z;
      dr[Z_POS] = z;
      updateRenderer();
    }
  }

  xPosition(args, util) {
    if (util.target.isStage) return '0';
    return util.target.x.toString();
  }

  yPosition(args, util) {
    if (util.target.isStage) return '0';
    return util.target.y.toString();
  }

  zPosition(args, util) {
    if (util.target.isStage) return '0';
    if (!is3DInitialized || is3DHidden) return '0';
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (dr[IN_3D] && dr[OBJECT]) {
      return dr[OBJECT].position.z.toString();
    }
    return '0';
  }

  changePosition(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dx = Cast.toNumber(args.X);
    const dy = Cast.toNumber(args.Y);
    const dz = Cast.toNumber(args.Z);
    
    util.target.setXY(util.target.x + dx, util.target.y + dy);
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (dr[IN_3D] && dr[OBJECT]) {
      dr[OBJECT].position.x = util.target.x;
      dr[OBJECT].position.y = util.target.y;
      dr[OBJECT].position.z += dz;
      dr[Z_POS] = dr[OBJECT].position.z;
      updateRenderer();
    }
  }

  setRotation(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return;
    
    dr[ROLL] = Cast.toNumber(args.R) * Math.PI / 180;
    dr[PITCH] = Cast.toNumber(args.P) * Math.PI / 180;
    dr[YAW] = Cast.toNumber(args.Y) * Math.PI / 180;
    
    if (dr[OBJECT]) {
      dr[OBJECT].rotation.x = dr[PITCH];
      dr[OBJECT].rotation.y = dr[YAW];
      dr[OBJECT].rotation.z = dr[ROLL];
      updateRenderer();
    }
  }

  roll(args, util) {
    if (util.target.isStage) return '0';
    if (!is3DInitialized || is3DHidden) return '0';
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return '0';
    return (dr[ROLL] * 180 / Math.PI).toString();
  }

  pitch(args, util) {
    if (util.target.isStage) return '0';
    if (!is3DInitialized || is3DHidden) return '0';
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return '0';
    return (dr[PITCH] * 180 / Math.PI).toString();
  }

  yaw(args, util) {
    if (util.target.isStage) return '0';
    if (!is3DInitialized || is3DHidden) return '0';
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return '0';
    return (dr[YAW] * 180 / Math.PI).toString();
  }

  changeRotation(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return;
    
    dr[ROLL] += Cast.toNumber(args.R) * Math.PI / 180;
    dr[PITCH] += Cast.toNumber(args.P) * Math.PI / 180;
    dr[YAW] += Cast.toNumber(args.Y) * Math.PI / 180;
    
    if (dr[OBJECT]) {
      dr[OBJECT].rotation.x = dr[PITCH];
      dr[OBJECT].rotation.y = dr[YAW];
      dr[OBJECT].rotation.z = dr[ROLL];
      updateRenderer();
    }
  }

  setPosMenu(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const value = Cast.toNumber(args.NUMBER);
    const dr = renderer._allDrawables[util.target.drawableID];
    
    if (args.POSTYPES === "x") {
      util.target.setXY(value, util.target.y);
      if (dr[IN_3D] && dr[OBJECT]) {
        dr[OBJECT].position.x = value;
        updateRenderer();
      }
    } else if (args.POSTYPES === "y") {
      util.target.setXY(util.target.x, value);
      if (dr[IN_3D] && dr[OBJECT]) {
        dr[OBJECT].position.y = value;
        updateRenderer();
      }
    } else if (args.POSTYPES === "z") {
      if (dr[IN_3D] && dr[OBJECT]) {
        dr[OBJECT].position.z = value;
        dr[Z_POS] = value;
        updateRenderer();
      }
    }
  }

  setRotMenu(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return;
    
    const value = Cast.toNumber(args.NUMBER) * Math.PI / 180;
    
    if (args.ROTTYPES === "roll") {
      dr[ROLL] = value;
    } else if (args.ROTTYPES === "pitch") {
      dr[PITCH] = value;
    } else if (args.ROTTYPES === "yaw") {
      dr[YAW] = value;
    }
    
    if (dr[OBJECT]) {
      dr[OBJECT].rotation.x = dr[PITCH];
      dr[OBJECT].rotation.y = dr[YAW];
      dr[OBJECT].rotation.z = dr[ROLL];
      updateRenderer();
    }
  }

  directionAround(args, util) {
    if (util.target.isStage) return '0';
    if (!is3DInitialized || is3DHidden) return '0';
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return '0';
    
    let value;
    if (args.ROTTYPES === "roll") {
      value = dr[ROLL] * 180 / Math.PI;
    } else if (args.ROTTYPES === "pitch") {
      value = dr[PITCH] * 180 / Math.PI;
    } else if (args.ROTTYPES === "yaw") {
      value = dr[YAW] * 180 / Math.PI;
    }
    
    return value.toString();
  }

  position(args, util) {
    if (util.target.isStage) return JSON.stringify([0, 0, 0]);
    if (!is3DInitialized || is3DHidden) return JSON.stringify([util.target.x, util.target.y, 0]);
    
    const dr = renderer._allDrawables[util.target.drawableID];
    const z = dr[IN_3D] && dr[OBJECT] ? dr[OBJECT].position.z : 0;
    
    if (args.TYPE === "array") {
      return JSON.stringify([util.target.x, util.target.y, z]);
    } else {
      return JSON.stringify({x: util.target.x, y: util.target.y, z: z});
    }
  }

  rotation(args, util) {
    if (util.target.isStage) return JSON.stringify([0, 0, 0]);
    if (!is3DInitialized || is3DHidden) return JSON.stringify([0, 0, 0]);
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return JSON.stringify([0, 0, 0]);
    
    const roll = dr[ROLL] * 180 / Math.PI;
    const pitch = dr[PITCH] * 180 / Math.PI;
    const yaw = dr[YAW] * 180 / Math.PI;
    
    if (args.TYPE === "array") {
      return JSON.stringify([roll, pitch, yaw]);
    } else {
      return JSON.stringify({roll: roll, pitch: pitch, yaw: yaw});
    }
  }

  turnDegrees(args, util) {
    if (util.target.isStage) return;
    
    const degrees = Cast.toNumber(args.NUM);
    let direction = util.target.direction;
    
    switch (args.TURNDIRS) {
      case "up":
        direction = 0;
        break;
      case "down":
        direction = 180;
        break;
      case "left":
        direction += degrees;
        break;
      case "right":
        direction -= degrees;
        break;
    }
    
    util.target.setDirection(direction);
  }

  direction(args, util) {
    if (util.target.isStage) return '0';
    return util.target.direction.toString();
  }

  getSprites() {
    const spriteNames = [{ text: "myself", value: "myself" }];
    const targets = runtime.targets;
    for (let index = 1; index < targets.length; index++) {
      const target = targets[index];
      if (target.isOriginal && target.sprite) {
        spriteNames.push({
          text: target.sprite.name,
          value: target.sprite.name
        });
      }
    }
    return spriteNames.length > 1 ? spriteNames : [{ text: "myself", value: "myself" }];
  }
}

class ThreeLooks {
  constructor() {}

  getInfo() {
    return {
      id: 'Dragonian3DLooks',
      name: 'Looks 3D',
      color1: extcolors.Looks[0],
      color2: extcolors.Looks[1],
      color3: extcolors.Looks[2],
      blocks: [
        {
          opcode: "existingModels",
          blockType: BlockType.REPORTER,
          text: "existing models",
        },
        {
          opcode: "existingMaterials",
          blockType: BlockType.REPORTER,
          text: "existing materials",
        },
        {
          opcode: "spriteMode",
          blockType: BlockType.REPORTER,
          text: "sprite mode",
        },
        {
          opcode: "flatLayers",
          blockType: BlockType.REPORTER,
          text: "flat mode layers",
        },
        {
          opcode: "setMode",
          blockType: BlockType.COMMAND,
          text: "set sprite mode to [MODE]",
          arguments: {
            MODE: {
              type: ArgumentType.STRING,
              menu: "MODE_MENU",
              defaultValue: "disabled",
            },
          },
        },
        {
          opcode: "setFlatLayers",
          blockType: BlockType.COMMAND,
          text: "set flat mode layers to [LAYERS]",
          arguments: {
            LAYERS: { type: ArgumentType.NUMBER, defaultValue: 1 }
          },
        },
        {
          opcode: "setModel",
          blockType: BlockType.COMMAND,
          text: "set model to [MODEL]",
          arguments: {
            MODEL: { type: ArgumentType.STRING, defaultValue: "" },
          },
        },
        {
          opcode: "currentModel",
          blockType: BlockType.REPORTER,
          text: "current model",
        },
        {
          opcode: "createModelFromString",
          blockType: BlockType.COMMAND,
          text: "create model named [NAME] from data [STRINGDATA]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "new model" },
            STRINGDATA: { type: ArgumentType.STRING, defaultValue: "" },
          },
        },
        {
          opcode: "createModelFromList",
          blockType: BlockType.COMMAND,
          text: "create model named [NAME] from list [LIST]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "new model" },
            LIST: { type: ArgumentType.STRING, menu: "listsMenu", defaultValue: "" },
          },
        },
        {
          opcode: "deletemodel",
          blockType: BlockType.COMMAND,
          text: "delete model [MODEL]",
          arguments: {
            MODEL: { type: ArgumentType.STRING, defaultValue: "" },
          }
        },
        {
          opcode: "setTextureFilter",
          blockType: BlockType.COMMAND,
          text: "set texture filter to [TEXTUREFILTER]",
          arguments: {
            TEXTUREFILTER: { type: ArgumentType.STRING, menu: "texturefilter", defaultValue: "nearest" },
          },
        },
        {
          opcode: "getTextureFilter",
          blockType: BlockType.REPORTER,
          text: "texture filter",
        },
        {
          opcode: "showFaces",
          blockType: BlockType.COMMAND,
          text: "show faces [SHOWFACES] of myself",
          arguments: {
            SHOWFACES: { type: ArgumentType.STRING, menu: "showfaces", defaultValue: "both" },
          },
        },
        {
          opcode: "getShowFaces",
          blockType: BlockType.REPORTER,
          text: "show faces",
        },
        {
          opcode: "set3DStretch",
          blockType: BlockType.COMMAND,
          text: "set 3D stretch to x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 100 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 100 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 100 },
          },
        },
        {
          opcode: "stretchX",
          blockType: BlockType.REPORTER,
          text: "3D stretch x",
        },
        {
          opcode: "stretchY",
          blockType: BlockType.REPORTER,
          text: "3D stretch y",
        },
        {
          opcode: "stretchZ",
          blockType: BlockType.REPORTER,
          text: "3D stretch z",
        },
        {
          opcode: "change3DStretch",
          blockType: BlockType.COMMAND,
          text: "change 3D stretch by x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "set3DStretchMenu",
          blockType: BlockType.COMMAND,
          text: "set 3D stretch [POSTYPES] to [NUMBER]",
          arguments: {
            POSTYPES: { type: ArgumentType.STRING, menu: "postypes", defaultValue: "x" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 100 },
          },
        },
        {
          opcode: "change3DStretchMenu",
          blockType: BlockType.COMMAND,
          text: "change 3D stretch [POSTYPES] by [NUMBER]",
          arguments: {
            POSTYPES: { type: ArgumentType.STRING, menu: "postypes", defaultValue: "x" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "stretches",
          blockType: BlockType.REPORTER,
          text: "3D stretches as [TYPE]",
          arguments: {
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "setModelMaterial",
          blockType: BlockType.COMMAND,
          text: "set model material to [MATERIAL]",
          arguments: {
            MATERIAL: { type: ArgumentType.STRING, defaultValue: "basic" }
          },
        },
        {
          opcode: "currentMaterial",
          blockType: BlockType.REPORTER,
          text: "current material",
        },
        {
          opcode: "resetMaterial",
          blockType: BlockType.COMMAND,
          text: "reset material",
        },
        {
          opcode: "addMaterial",
          blockType: BlockType.COMMAND,
          text: "add material named [NAME] from [URL]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "new material" },
            URL: { type: ArgumentType.STRING, defaultValue: "" }
          },
        },
        {
          opcode: "removeMaterial",
          blockType: BlockType.COMMAND,
          text: "remove material [MATERIAL]",
          arguments: {
            MATERIAL: { type: ArgumentType.STRING, defaultValue: "" }
          },
        },
      ],
      menus: {
        MODE_MENU: {
          acceptReporters: true,
          items: ["disabled", "model", "flat", "flat triangle", "cube", "sphere", "low-poly sphere"],
        },
        texturefilter: {
          acceptReporters: true,
          items: ["nearest", "linear"],
        },
        showfaces: {
          acceptReporters: true,
          items: ["both", "front", "back"],
        },
        postypes: {
          acceptReporters: true,
          items: ["x", "y", "z"],
        },
        dataTypeMenu: {
          acceptReporters: true,
          items: [{ text: "array", value: "array" }, { text: "object", value: "object" }]
        },
        listsMenu: {
          acceptReporters: true,
          items: "getLists"
        }
      },
    };
  }

  existingModels() {
    if (!is3DInitialized || is3DHidden) return JSON.stringify([]);
    return JSON.stringify(Object.keys(loadedModels));
  }

  existingMaterials() {
    if (!is3DInitialized || is3DHidden) return JSON.stringify([]);
    
    const materials = new Set();
    
    Object.keys(loadedMaterials).forEach(key => materials.add(key));
    
    if (THREE.Materials) {
      Object.keys(THREE.Materials).forEach(key => materials.add(key));
    }
    
    return JSON.stringify(Array.from(materials));
  }

  spriteMode(args, util) {
    if (util.target.isStage) return "disabled";
    if (!is3DInitialized || is3DHidden) return "disabled";
    
    const dr = renderer._allDrawables[util.target.drawableID];
    return dr._3dMode || "disabled";
  }

  flatLayers(args, util) {
    if (util.target.isStage) return '1';
    if (!is3DInitialized || is3DHidden) return '1';
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return '1';
    return (dr._flatLayers || 1).toString();
  }

  setMode(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const mode = Cast.toString(args.MODE);
    const dr = renderer._allDrawables[util.target.drawableID];
    
    if (mode === "disabled") {
      disable3DForDrawable(util.target.drawableID);
    } else if (mode === "model") {
      if (!util.target.lastModel || !loadedModels[util.target.lastModel]) {
        if (!dr[IN_3D]) {
          enable3DForDrawable(util.target.drawableID, "flat");
        } else {
          dr._3dMode = "flat";
          updateMeshForDrawable(util.target.drawableID, "flat");
        }
      } else {
        if (!dr[IN_3D]) {
          enable3DForDrawable(util.target.drawableID, "model");
        } else {
          dr._3dMode = "model";
          updateMeshForDrawable(util.target.drawableID, "model");
        }
        this._applyModelToTarget(util.target, util.target.lastModel);
      }
    } else {
      if (!dr[IN_3D]) {
        enable3DForDrawable(util.target.drawableID, mode);
      } else {
        dr._3dMode = mode;
        updateMeshForDrawable(util.target.drawableID, mode);
      }
    }
  }

  setFlatLayers(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return;
    
    const layers = Math.max(1, Math.floor(Cast.toNumber(args.LAYERS)));
    dr._flatLayers = layers;
    
    if (dr._3dMode === "flat" && dr[OBJECT] && dr[OBJECT].geometry) {
      dr[OBJECT].geometry.dispose();
      dr[OBJECT].geometry = new THREE.PlaneGeometry(
        dr.skin.size[0], 
        dr.skin.size[1], 
        1, 
        layers
      );
      updateRenderer();
    }
  }

  setModel(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const modelName = Cast.toString(args.MODEL);
    if (!modelName || !loadedModels[modelName]) return;
    
    util.target.lastModel = modelName;
    
    enable3DForDrawable(util.target.drawableID, "model");
    this._applyModelToTarget(util.target, modelName);
  }

  currentModel(args, util) {
    if (util.target.isStage) return "";
    if (!is3DInitialized || is3DHidden) return "";
    return util.target.lastModel || "";
  }

  async createModelFromString(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const data = Cast.toString(args.STRINGDATA);
    
    if (loadedModels[name]) {
      console.warn(`Model "${name}" already exists`);
      return;
    }
    
    try {
      let model;
      let url;
      

      if (data.startsWith('data:')) {
        url = data;
      } else if (data.startsWith('http') || data.startsWith('blob:')) {
        url = data;
      } else if (data.startsWith('{') || data.startsWith('o')) {
        const blob = new Blob([data], { type: 'text/plain' });
        url = URL.createObjectURL(blob);
      } else if (data.startsWith('iVBORw0KGgo')) {
        url = 'data:model/obj;base64,' + data;
      } else {
        if (data.includes('{"asset":') || data.includes('{"nodes":')) {
          const blob = new Blob([data], { type: 'model/gltf+json' });
          url = URL.createObjectURL(blob);
        } else {
          const blob = new Blob([data], { type: 'model/obj' });
          url = URL.createObjectURL(blob);
        }
      }
      

      let type = "OBJ";
      if (data.includes('{"asset":') || data.includes('{"nodes":') || data.startsWith('data:application/json') || data.startsWith('data:model/gltf')) {
        type = "GLTF";
      }
      
      if (type === "GLTF") {
        const loader = new THREE.GLTFLoader();
        const gltf = await loader.loadAsync(url);
        model = gltf.scene;
      } else {
        const loader = new THREE.OBJLoader();
        model = await loader.loadAsync(url);
      }
      
      if (url.startsWith('blob:')) {
        URL.revokeObjectURL(url);
      }
      
      model.traverse(child => {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          
          if (child.material) {
            const materialName = name + "_material_" + Math.random().toString(36).substring(2, 9);
            loadedMaterials[materialName] = child.material.clone();
          }
        }
      });
      
      loadedModels[name] = model;
    } catch (error) {
      console.error(`Failed to create model "${name}":`, error);
    }
  }

  async createModelFromList(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const listName = Cast.toString(args.LIST);
    
    const allLists = this.getLists();
    const listExists = allLists.some(item => item.value === listName);
    
    if (!listExists) {
      console.warn(`List "${listName}" not found`);
      return;
    }
    
    let target = runtime.getTargetForStage();
    let list = null;
    
    const targets = runtime.targets;
    for (const t of targets) {
      const variables = t.variables;
      for (const varId in variables) {
        const variable = variables[varId];
        if (variable.type === 'list' && variable.name === listName) {
          list = variable.value;
          break;
        }
      }
      if (list) break;
    }
    
    if (!list || list.length === 0) {
      console.warn(`List "${listName}" is empty`);
      return;
    }
    
    const data = list.join('\n');
    await this.createModelFromString({ NAME: name, STRINGDATA: data });
  }

  _applyModelToTarget(target, modelName) {
    const dr = renderer._allDrawables[target.drawableID];
    if (!dr[IN_3D] || !dr[OBJECT]) return;
    
    const model = loadedModels[modelName].clone();
    model.position.copy(dr[OBJECT].position);
    model.rotation.copy(dr[OBJECT].rotation);
    model.scale.copy(dr[OBJECT].scale);
    
    model.traverse(child => {
      if (child.isMesh) {
        if (!child.userData.originalMaterial) {
          child.userData.originalMaterial = child.material.clone();
        }
      }
    });
    
    while (dr[OBJECT].children.length > 0) {
      dr[OBJECT].remove(dr[OBJECT].children[0]);
    }
    
    dr[OBJECT].add(model);
    
    const currentMaterial = dr[MATERIAL_NAME];
    if (currentMaterial && loadedMaterials[currentMaterial]) {
      this._applyMaterialToDrawable(target.drawableID, currentMaterial);
    }
    
    updateRenderer();
  }

  deletemodel(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.MODEL);
    if (loadedModels[name]) {
      loadedModels[name].traverse(child => {
        if (child.dispose) child.dispose();
      });
      delete loadedModels[name];
    }
  }

  setTextureFilter(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return;
    
    const filter = Cast.toString(args.TEXTUREFILTER);
    dr[TEX_FILTER] = filter === "nearest" ? THREE.NearestFilter : THREE.LinearMipmapLinearFilter;
    
    if (dr[OBJECT] && dr[OBJECT].material?.map) {
      dr[OBJECT].material.map.minFilter = dr[TEX_FILTER];
      dr[OBJECT].material.map.magFilter = dr[TEX_FILTER] === THREE.LinearMipmapLinearFilter ? THREE.LinearFilter : dr[TEX_FILTER];
      dr[OBJECT].material.map.needsUpdate = true;
      updateRenderer();
    }
  }

  getTextureFilter(args, util) {
    if (util.target.isStage) return "nearest";
    if (!is3DInitialized || is3DHidden) return "nearest";
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return "nearest";
    
    return dr[TEX_FILTER] === THREE.NearestFilter ? "nearest" : "linear";
  }

  showFaces(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return;
    
    const side = Cast.toString(args.SHOWFACES);
    const sides = {
      "both": THREE.DoubleSide,
      "front": THREE.FrontSide,
      "back": THREE.BackSide
    };
    
    dr[SIDE_MODE] = sides[side] || THREE.DoubleSide;
    
    if (dr[OBJECT] && dr[OBJECT].material) {
      dr[OBJECT].material.side = dr[SIDE_MODE];
      updateRenderer();
    }
  }

  getShowFaces(args, util) {
    if (util.target.isStage) return "both";
    if (!is3DInitialized || is3DHidden) return "both";
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D]) return "both";
    
    switch (dr[SIDE_MODE]) {
      case THREE.DoubleSide: return "both";
      case THREE.FrontSide: return "front";
      case THREE.BackSide: return "back";
      default: return "both";
    }
  }

  set3DStretch(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || !dr[OBJECT]) return;
    
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    dr[OBJECT].scale.x = x / 100;
    dr[OBJECT].scale.y = y / 100;
    dr[OBJECT].scale.z = z / 100;
    dr[Z_STRETCH] = z;
    
    updateRenderer();
  }

  stretchX(args, util) {
    if (util.target.isStage) return '100';
    if (!is3DInitialized || is3DHidden) return '100';
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || !dr[OBJECT]) return '100';
    return (dr[OBJECT].scale.x * 100).toString();
  }

  stretchY(args, util) {
    if (util.target.isStage) return '100';
    if (!is3DInitialized || is3DHidden) return '100';
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || !dr[OBJECT]) return '100';
    return (dr[OBJECT].scale.y * 100).toString();
  }

  stretchZ(args, util) {
    if (util.target.isStage) return '100';
    if (!is3DInitialized || is3DHidden) return '100';
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || !dr[OBJECT]) return '100';
    return (dr[OBJECT].scale.z * 100).toString();
  }

  change3DStretch(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || !dr[OBJECT]) return;
    
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    dr[OBJECT].scale.x += x / 100;
    dr[OBJECT].scale.y += y / 100;
    dr[OBJECT].scale.z += z / 100;
    dr[Z_STRETCH] = dr[OBJECT].scale.z * 100;
    
    updateRenderer();
  }

  set3DStretchMenu(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || !dr[OBJECT]) return;
    
    const value = Cast.toNumber(args.NUMBER) / 100;
    
    switch (args.POSTYPES) {
      case "x":
        dr[OBJECT].scale.x = value;
        break;
      case "y":
        dr[OBJECT].scale.y = value;
        break;
      case "z":
        dr[OBJECT].scale.z = value;
        dr[Z_STRETCH] = value * 100;
        break;
    }
    
    updateRenderer();
  }

  change3DStretchMenu(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || !dr[OBJECT]) return;
    
    const value = Cast.toNumber(args.NUMBER) / 100;
    
    switch (args.POSTYPES) {
      case "x":
        dr[OBJECT].scale.x += value;
        break;
      case "y":
        dr[OBJECT].scale.y += value;
        break;
      case "z":
        dr[OBJECT].scale.z += value;
        dr[Z_STRETCH] = dr[OBJECT].scale.z * 100;
        break;
    }
    
    updateRenderer();
  }

  stretches(args, util) {
    if (util.target.isStage) {
      if (args.TYPE === "array") {
        return JSON.stringify([100, 100, 100]);
      } else {
        return JSON.stringify({x: 100, y: 100, z: 100});
      }
    }
    
    if (!is3DInitialized || is3DHidden) {
      if (args.TYPE === "array") {
        return JSON.stringify([100, 100, 100]);
      } else {
        return JSON.stringify({x: 100, y: 100, z: 100});
      }
    }
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || !dr[OBJECT]) {
      if (args.TYPE === "array") {
        return JSON.stringify([100, 100, 100]);
      } else {
        return JSON.stringify({x: 100, y: 100, z: 100});
      }
    }
    
    const x = dr[OBJECT].scale.x * 100;
    const y = dr[OBJECT].scale.y * 100;
    const z = dr[OBJECT].scale.z * 100;
    
    if (args.TYPE === "array") {
      return JSON.stringify([x, y, z]);
    } else {
      return JSON.stringify({x: x, y: y, z: z});
    }
  }

  setModelMaterial(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || dr._3dMode !== "model") return;
    
    const materialName = Cast.toString(args.MATERIAL);
    if (materialName === "basic") {
      this.resetMaterial(args, util);
      return;
    }
    
    let material = null;
    if (THREE.Materials[materialName]) {
      material = THREE.Materials[materialName].clone();
    } else if (loadedMaterials[materialName]) {
      material = loadedMaterials[materialName].clone();
    }
    
    if (!material) return;
    
    dr[MATERIAL_NAME] = materialName;
    this._applyMaterialToDrawable(util.target.drawableID, materialName);
  }

  currentMaterial(args, util) {
    if (util.target.isStage) return "";
    if (!is3DInitialized || is3DHidden) return "";
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || dr._3dMode !== "model") return "";
    return dr[MATERIAL_NAME] || "";
  }

  resetMaterial(args, util) {
    if (!is3DInitialized || is3DHidden || util.target.isStage) return;
    
    const dr = renderer._allDrawables[util.target.drawableID];
    if (!dr[IN_3D] || dr._3dMode !== "model") return;
    
    dr[MATERIAL_NAME] = null;
    
    if (dr[OBJECT]) {
      dr[OBJECT].traverse(child => {
        if (child.isMesh && child.userData.originalMaterial) {
          child.material.dispose();
          child.material = child.userData.originalMaterial.clone();
        }
      });
    }
    
    updateRenderer();
  }

  async addMaterial(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const url = Cast.toString(args.URL);
    
    if (loadedMaterials[name]) {
      console.warn(`Material "${name}" already exists`);
      return;
    }
    
    try {
      if (url.startsWith('data:')) {
        const material = await this._loadMaterialFromDataURL(url);
        if (material) {
          loadedMaterials[name] = material;
        }
      } else if (url.startsWith('http') || url.startsWith('blob:')) {
        const material = await this._loadMaterialFromURL(url);
        if (material) {
          loadedMaterials[name] = material;
        }
      } else {
        const material = await this._loadMaterialFromData(url);
        if (material) {
          loadedMaterials[name] = material;
        }
      }
    } catch (error) {
      console.error(`Failed to load material "${name}":`, error);
    }
  }

  removeMaterial(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const materialName = Cast.toString(args.MATERIAL);
    if (loadedMaterials[materialName]) {
      loadedMaterials[materialName].dispose();
      delete loadedMaterials[materialName];
    }
  }

  async _loadMaterialFromDataURL(dataURL) {
    return new Promise((resolve) => {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(dataURL, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide
        });
        resolve(material);
      }, undefined, (error) => {
        console.error('Failed to load texture from data URL:', error);
        resolve(null);
      });
    });
  }

  async _loadMaterialFromURL(url) {
    return new Promise((resolve) => {
      const textureLoader = new THREE.TextureLoader();
      textureLoader.load(url, (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        const material = new THREE.MeshStandardMaterial({
          map: texture,
          side: THREE.DoubleSide
        });
        resolve(material);
      }, undefined, (error) => {
        console.error('Failed to load texture from URL:', error);
        resolve(null);
      });
    });
  }

  async _loadMaterialFromData(data) {
    try {
      const json = JSON.parse(data);
      const loader = new THREE.MaterialLoader();
      const material = loader.parse(json);
      return material;
    } catch (e) {
      return null;
    }
  }

  _applyMaterialToDrawable(drawableID, materialName) {
    const dr = renderer._allDrawables[drawableID];
    if (!dr[IN_3D] || dr._3dMode !== "model" || !dr[OBJECT]) return;
    
    let material = null;
    if (THREE.Materials[materialName]) {
      material = THREE.Materials[materialName].clone();
    } else if (loadedMaterials[materialName]) {
      material = loadedMaterials[materialName].clone();
    }
    
    if (!material) return;
    
    dr[OBJECT].traverse(child => {
      if (child.isMesh) {
        child.material.dispose();
        child.material = material.clone();
      }
    });
    
    updateRenderer();
  }

  getLists() {
    const lists = getAllLists();
    const menuItems = lists.map(list => ({ text: list, value: list }));
    return menuItems.length > 0 ? menuItems : [{ text: "", value: "" }];
  }
}

class ThreeLighting {
  constructor() {}

  getInfo() {
    return {
      id: 'Dragonian3DLighting',
      name: 'Lighting 3D',
      color1: extcolors.Lighting[0],
      color2: extcolors.Lighting[1],
      color3: extcolors.Lighting[2],
      blocks: [
        {
          opcode: "setLightDependency",
          blockType: BlockType.COMMAND,
          text: "make [SPRITE] [LIGHTDEPEDENCY]",
          arguments: {
            SPRITE: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
            LIGHTDEPEDENCY: { type: ArgumentType.STRING, menu: "lightDepMenu", defaultValue: "lid" }
          },
        },
        {
          opcode: "getLightDependency",
          blockType: BlockType.REPORTER,
          text: "light dependency of [SPRITE]",
          arguments: {
            SPRITE: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" }
          },
        },
        {
          opcode: "existingLights",
          blockType: BlockType.REPORTER,
          text: "existing lights",
        },
        {
          opcode: "lightsData",
          blockType: BlockType.REPORTER,
          text: "lights data",
        },
        {
          opcode: "createLight",
          blockType: BlockType.COMMAND,
          text: "create [TYPE] light named [NAME]",
          arguments: {
            TYPE: { type: ArgumentType.STRING, menu: "lightTypes", defaultValue: "ambient" },
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
        },
        {
          opcode: "lightExists",
          blockType: BlockType.BOOLEAN,
          text: "light [NAME] exists?",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
        },
        {
          opcode: "deleteLight",
          blockType: BlockType.COMMAND,
          text: "delete light [NAME]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
        },
        '---',
        {
          opcode: "setLightPosition",
          blockType: BlockType.COMMAND,
          text: "set light [NAME] position to x:[X] y:[Y] z:[Z]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
        },
        {
          opcode: "lightPosition",
          blockType: BlockType.REPORTER,
          text: "light [NAME] position as [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "changeLightPosition",
          blockType: BlockType.COMMAND,
          text: "change light [NAME] position by x:[X] y:[Y] z:[Z]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
        },
        {
          opcode: "setLightRotation",
          blockType: BlockType.COMMAND,
          text: "set light [NAME] rotation to r:[R] p:[P] y:[Y]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
        },
        {
          opcode: "lightRotation",
          blockType: BlockType.REPORTER,
          text: "light [NAME] rotation as [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "changeLightRotation",
          blockType: BlockType.COMMAND,
          text: "change light [NAME] rotation by r:[R] p:[P] y:[Y]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
        },
        {
          opcode: "setLightColor",
          blockType: BlockType.COMMAND,
          text: "set light [NAME] color to [COLOR]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            COLOR: { type: ArgumentType.COLOR, defaultValue: "#ffffff" }
          },
        },
        {
          opcode: "lightColor",
          blockType: BlockType.REPORTER,
          text: "light [NAME] color",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
        },
        {
          opcode: "setLightIntensity",
          blockType: BlockType.COMMAND,
          text: "set light [NAME] intensity to [INTENSITY]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            INTENSITY: { type: ArgumentType.NUMBER, defaultValue: 1 }
          },
        },
        {
          opcode: "lightIntensity",
          blockType: BlockType.REPORTER,
          text: "light [NAME] intensity",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
        },
        '---',
        {
          opcode: "attachLightToSprite",
          blockType: BlockType.COMMAND,
          text: "attach light [NAME] to [SPRITE] with type [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            SPRITE: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
            TYPE: { type: ArgumentType.STRING, menu: "bindTypeMenu", defaultValue: "both" }
          },
        },
        {
          opcode: "lightAttachedTo",
          blockType: BlockType.REPORTER,
          text: "sprite light [NAME] is attached to",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
        },
        {
          opcode: "detachLight",
          blockType: BlockType.COMMAND,
          text: "detach light [NAME]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
        },
        {
          opcode: "setLightPositionalOffset",
          blockType: BlockType.COMMAND,
          text: "set light positional offset of [NAME] to x:[X] y:[Y] z:[Z]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "lightPositionalOffset",
          blockType: BlockType.REPORTER,
          text: "light [NAME] positional offset as [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "setLightRotationalOffset",
          blockType: BlockType.COMMAND,
          text: "set light rotational offset of [NAME] to r:[R] p:[P] y:[Y]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "lightRotationalOffset",
          blockType: BlockType.REPORTER,
          text: "light [NAME] rotational offset as [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
      ],
      menus: {
        lightDepMenu: {
          acceptReporters: true,
          items: [{ text: "light dependent", value: "ld" }, { text: "light independent", value: "lid" }]
        },
        lightTypes: {
          acceptReporters: true,
          items: ["ambient", "directional", "point", "spot", "hemisphere"]
        },
        spriteMenu: {
          acceptReporters: true,
          items: "getSprites",
        },
        bindTypeMenu: {
          acceptReporters: true,
          items: ["positional", "rotational", "both"]
        },
        dataTypeMenu: {
          acceptReporters: true,
          items: [{ text: "array", value: "array" }, { text: "object", value: "object" }]
        }
      },
    };
  }

  setLightDependency(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const spriteName = Cast.toString(args.SPRITE);
    const dependency = Cast.toString(args.LIGHTDEPEDENCY);
    
    let target;
    if (spriteName === "myself") {
      target = runtime.currentSprite;
    } else {
      target = runtime.getSpriteTargetByName(spriteName);
    }
    
    if (!target || target.isStage) return;
    
    const dr = renderer._allDrawables[target.drawableID];
    if (!dr[IN_3D] || dr._3dMode === "disabled") return;
    

    dr[LIGHT_DEP] = dependency;
    
    if (dr._3dMode === "model") {
      const looks = new ThreeLooks();
      const currentMaterial = dr[MATERIAL_NAME];
      if (currentMaterial) {
        looks._applyMaterialToDrawable(target.drawableID, currentMaterial);
      } else {
        looks.resetMaterial({}, { target: target });
      }
    } else {
      if (dr[OBJECT] && dr[OBJECT].material) {
        const isLD = dependency === "ld";
        const texture = dr[OBJECT].material.map;
        const side = dr[OBJECT].material.side;
        const transparent = dr[OBJECT].material.transparent;
        const alphaTest = dr[OBJECT].material.alphaTest;
        
        dr[OBJECT].material.dispose();
        
        if (isLD) {
          dr[OBJECT].material = new THREE.MeshLambertMaterial({
            map: texture,
            side: side,
            transparent: transparent,
            alphaTest: alphaTest
          });
        } else {
          dr[OBJECT].material = new THREE.MeshBasicMaterial({
            map: texture,
            side: side,
            transparent: transparent,
            alphaTest: alphaTest
          });
        }
        
        dr[OBJECT].material.needsUpdate = true;
      }
    }
    
    updateRenderer();
  }

  getLightDependency(args) {
    const spriteName = Cast.toString(args.SPRITE);
    
    let target;
    if (spriteName === "myself") {
      target = runtime.currentSprite;
    } else {
      target = runtime.getSpriteTargetByName(spriteName);
    }
    
    if (!target || target.isStage) return "lid";
    
    const dr = renderer._allDrawables[target.drawableID];
    if (!dr[IN_3D] || dr._3dMode === "disabled") return "lid";
    

    return dr[LIGHT_DEP] || "lid";
  }

  existingLights() {
    if (!is3DInitialized || is3DHidden) return JSON.stringify([]);
    
    const lightNames = Object.keys(lights);
    return JSON.stringify(lightNames);
  }

  lightsData() {
    if (!is3DInitialized || is3DHidden) return JSON.stringify([]);
    
    const lightData = [];
    for (const name in lights) {
      lightData.push({
        name: name,
        type: lights[name].type
      });
    }
    return JSON.stringify(lightData);
  }

  createLight(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const type = Cast.toString(args.TYPE);
    const name = Cast.toString(args.NAME);
    
    if (lights[name]) {
      scene.remove(lights[name].light);
      if (lights[name].light.dispose) lights[name].light.dispose();
      if (lights[name].light.target) {
        scene.remove(lights[name].light.target);
      }
    }
    
    let light;
    const lightId = lightCounter++;
    
    switch (type) {
      case "ambient":
        light = new THREE.AmbientLight(0xffffff, 1);
        break;
      case "directional":
        light = new THREE.DirectionalLight(0xffffff, 1);
        light.position.set(0, 10, 0);
        light.target.position.set(0, 0, 0);
        scene.add(light.target);
        break;
      case "point":
        light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(0, 10, 0);
        break;
      case "spot":
        light = new THREE.SpotLight(0xffffff, 1, 100, Math.PI/4, 0.25, 1);
        light.position.set(0, 10, 0);
        light.target.position.set(0, 0, 0);
        scene.add(light.target);
        break;
      case "hemisphere":
        light = new THREE.HemisphereLight(0xffffff, 0x000000, 1);
        light.position.set(0, 10, 0);
        break;
      default:
        return;
    }
    
    lights[name] = {
      id: lightId,
      light: light,
      type: type,
      attachedTo: null,
      attachmentType: null,
      positionalOffset: new THREE.Vector3(0, 0, 0),
      rotationalOffset: new THREE.Euler(0, 0, 0, 'YXZ')
    };
    
    scene.add(light);
    updateRenderer();
  }

  lightExists(args) {
    if (!is3DInitialized || is3DHidden) return false;
    
    const name = Cast.toString(args.NAME);
    return !!lights[name];
  }

  deleteLight(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    
    if (lights[name]) {
      scene.remove(lights[name].light);
      if (lights[name].light.dispose) lights[name].light.dispose();
      if (lights[name].light.target) {
        scene.remove(lights[name].light.target);
      }
      delete lights[name];
      updateRenderer();
    }
  }

  setLightPosition(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    if (lights[name] && lights[name].light) {
      lights[name].light.position.set(x, y, z);
      updateRenderer();
    }
  }

  lightPosition(args) {
    if (!is3DInitialized || is3DHidden) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({x: 0, y: 0, z: 0});
    }
    
    const name = Cast.toString(args.NAME);
    
    if (!lights[name] || !lights[name].light) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({x: 0, y: 0, z: 0});
    }
    
    const light = lights[name].light;
    
    if (args.TYPE === "array") {
      return JSON.stringify([light.position.x, light.position.y, light.position.z]);
    } else {
      return JSON.stringify({x: light.position.x, y: light.position.y, z: light.position.z});
    }
  }

  changeLightPosition(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    if (lights[name] && lights[name].light) {
      lights[name].light.position.x += x;
      lights[name].light.position.y += y;
      lights[name].light.position.z += z;
      updateRenderer();
    }
  }

  setLightRotation(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const roll = Cast.toNumber(args.R) * Math.PI / 180;
    const pitch = Cast.toNumber(args.P) * Math.PI / 180;
    const yaw = Cast.toNumber(args.Y) * Math.PI / 180;
    
    if (lights[name] && lights[name].light) {
      lights[name].light.rotation.set(pitch, yaw, roll);
      updateRenderer();
    }
  }

  lightRotation(args) {
    if (!is3DInitialized || is3DHidden) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({roll: 0, pitch: 0, yaw: 0});
    }
    
    const name = Cast.toString(args.NAME);
    
    if (!lights[name] || !lights[name].light) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({roll: 0, pitch: 0, yaw: 0});
    }
    
    const light = lights[name].light;
    const roll = light.rotation.z * 180 / Math.PI;
    const pitch = light.rotation.x * 180 / Math.PI;
    const yaw = light.rotation.y * 180 / Math.PI;
    
    if (args.TYPE === "array") {
      return JSON.stringify([roll, pitch, yaw]);
    } else {
      return JSON.stringify({roll: roll, pitch: pitch, yaw: yaw});
    }
  }

  changeLightRotation(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const roll = Cast.toNumber(args.R) * Math.PI / 180;
    const pitch = Cast.toNumber(args.P) * Math.PI / 180;
    const yaw = Cast.toNumber(args.Y) * Math.PI / 180;
    
    if (lights[name] && lights[name].light) {
      lights[name].light.rotation.x += pitch;
      lights[name].light.rotation.y += yaw;
      lights[name].light.rotation.z += roll;
      updateRenderer();
    }
  }

  setLightColor(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const color = Cast.toString(args.COLOR);
    
    if (lights[name] && lights[name].light) {
      lights[name].light.color.set(color);
      updateRenderer();
    }
  }

  lightColor(args) {
    if (!is3DInitialized || is3DHidden) return '';
    
    const name = Cast.toString(args.NAME);
    
    if (!lights[name] || !lights[name].light) {
      return '';
    }
    
    return '#' + lights[name].light.color.getHexString();
  }

  setLightIntensity(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const intensity = Cast.toNumber(args.INTENSITY);
    
    if (lights[name] && lights[name].light) {
      lights[name].light.intensity = intensity;
      updateRenderer();
    }
  }

  lightIntensity(args) {
    if (!is3DInitialized || is3DHidden) return '0';
    
    const name = Cast.toString(args.NAME);
    
    if (!lights[name] || !lights[name].light) {
      return '0';
    }
    
    return lights[name].light.intensity.toString();
  }

  attachLightToSprite(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const spriteName = Cast.toString(args.SPRITE);
    const type = Cast.toString(args.TYPE);
    
    if (lights[name]) {
      lights[name].attachedTo = spriteName === "myself" ? runtime.currentSprite?.name : spriteName;
      lights[name].attachmentType = type;
      updateRenderer();
    }
  }

  lightAttachedTo(args) {
    if (!is3DInitialized || is3DHidden) return '';
    
    const name = Cast.toString(args.NAME);
    
    if (!lights[name]) {
      return '';
    }
    
    return lights[name].attachedTo || '';
  }

  detachLight(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    
    if (lights[name]) {
      lights[name].attachedTo = null;
      lights[name].attachmentType = null;
      updateRenderer();
    }
  }

  setLightPositionalOffset(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    if (lights[name]) {
      lights[name].positionalOffset.set(x, y, z);
      updateRenderer();
    }
  }

  lightPositionalOffset(args) {
    if (!is3DInitialized || is3DHidden) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({x: 0, y: 0, z: 0});
    }
    
    const name = Cast.toString(args.NAME);
    
    if (!lights[name]) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({x: 0, y: 0, z: 0});
    }
    
    const offset = lights[name].positionalOffset;
    
    if (args.TYPE === "array") {
      return JSON.stringify([offset.x, offset.y, offset.z]);
    } else {
      return JSON.stringify({x: offset.x, y: offset.y, z: offset.z});
    }
  }

  setLightRotationalOffset(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const name = Cast.toString(args.NAME);
    const r = Cast.toNumber(args.R) * Math.PI / 180;
    const p = Cast.toNumber(args.P) * Math.PI / 180;
    const y = Cast.toNumber(args.Y) * Math.PI / 180;
    
    if (lights[name]) {
      lights[name].rotationalOffset.set(p, y, r, 'YXZ');
      updateRenderer();
    }
  }

  lightRotationalOffset(args) {
    if (!is3DInitialized || is3DHidden) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({roll: 0, pitch: 0, yaw: 0});
    }
    
    const name = Cast.toString(args.NAME);
    
    if (!lights[name]) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({roll: 0, pitch: 0, yaw: 0});
    }
    
    const offset = lights[name].rotationalOffset;
    const roll = offset.z * 180 / Math.PI;
    const pitch = offset.x * 180 / Math.PI;
    const yaw = offset.y * 180 / Math.PI;
    
    if (args.TYPE === "array") {
      return JSON.stringify([roll, pitch, yaw]);
    } else {
      return JSON.stringify({roll: roll, pitch: pitch, yaw: yaw});
    }
  }

  getSprites() {
    const spriteNames = [{ text: "myself", value: "myself" }];
    const targets = runtime.targets;
    for (let index = 1; index < targets.length; index++) {
      const target = targets[index];
      if (target.isOriginal && target.sprite) {
        spriteNames.push({
          text: target.sprite.name,
          value: target.sprite.name
        });
      }
    }
    return spriteNames.length > 1 ? spriteNames : [{ text: "myself", value: "myself" }];
  }
}

class ThreeSound {
  constructor() {}

  getInfo() {
    return {
      id: 'Dragonian3DSound',
      name: 'Sound 3D',
      color1: extcolors.Sound[0],
      color2: extcolors.Sound[1],
      color3: extcolors.Sound[2],
      blocks: [
        {
          opcode: 'playSound3D',
          blockType: BlockType.COMMAND,
          text: 'play sound [sound] at x:[x] y:[y] z:[z] with volume [v] and range width:[w] height":[h] depth:[d]',
          arguments: {
            sound: { type: ArgumentType.SOUND},
            x: { type: ArgumentType.NUMBER, defaultValue: 0 },
            y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            z: { type: ArgumentType.NUMBER, defaultValue: 0 },
            v: { type: ArgumentType.NUMBER, defaultValue: 100 },
            w: { type: ArgumentType.NUMBER, defaultValue: 1000 },
            h: { type: ArgumentType.NUMBER, defaultValue: 1000 },
            d: { type: ArgumentType.NUMBER, defaultValue: 1000 },
          },
        },
        {
          opcode: 'isSoundPlaying3D',
          blockType: BlockType.BOOLEAN,
          text: 'is 3D sound playing?',
        },
      ]
    };
  }

  playSound3D() {
    if (!is3DInitialized || is3DHidden) return;
    return '';
  }

  isSoundPlaying3D() {
    return false;
  }
}

class ThreeEvents {
  constructor() {}

  getInfo() {
    return {
      id: 'Dragonian3DEvents',
      name: 'Events 3D',
      color1: extcolors.Events[0],
      color2: extcolors.Events[1],
      color3: extcolors.Events[2],
      blocks: [
        {
          opcode: 'WhenSpriteClicked3D',
          blockType: BlockType.HAT,
          text: 'When sprite clicked in 3D',
        },
        {
          opcode: 'isSpriteClicked3D',
          blockType: BlockType.BOOLEAN,
          text: 'is sprite clicked in 3D?',
        },
      ]
    };
  }

  WhenSpriteClicked3D() {
    return false;
  }

  isSpriteClicked3D() {
    if (!is3DInitialized || is3DHidden) return false;
    return false;
  }
}

class ThreeControl {
  constructor() {}

  getInfo() {
    return {
      id: 'Dragonian3DControl',
      name: 'Control 3D',
      color1: extcolors.Control[0],
      color2: extcolors.Control[1],
      color3: extcolors.Control[2],
      blocks: [
        {
          opcode: 'helloWorld',
          blockType: BlockType.REPORTER,
          text: 'hello world',
        }
      ]
    };
  }

  helloWorld() {
    return 'bork bork!';
  }
}

class ThreeSensing {
  constructor() {}

  getInfo() {
    return {
      id: 'Dragonian3DSensing',
      name: 'Sensing 3D',
      color1: extcolors.Sensing[0],
      color2: extcolors.Sensing[1],
      color3: extcolors.Sensing[2],
      blocks: [
        {
          opcode: 'createHitbox',
          blockType: BlockType.COMMAND,
          text: 'give [SPRITE] a [SHAPE] shaped hitbox named [HITBOX]',
          arguments: {
            SHAPE: { type: ArgumentType.STRING, menu: "shapes", defaultValue: "none" },
            HITBOX: { type: ArgumentType.STRING, defaultValue: "my hitbox" },
            SPRITE: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
          },
        },
        {
          opcode: 'hitboxExists',
          blockType: BlockType.BOOLEAN,
          text: 'hitbox [HITBOX] exists on [SPRITE]?',
          arguments: {
            HITBOX: { type: ArgumentType.STRING, defaultValue: "my hitbox" },
            SPRITE: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
          },
        },
        {
          opcode: 'deleteHitbox',
          blockType: BlockType.COMMAND,
          text: 'delete hitbox [HITBOX] of [SPRITE]',
          arguments: {
            HITBOX: { type: ArgumentType.STRING, defaultValue: "my hitbox" },
            SPRITE: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
          },
        },
        {
          opcode: 'createShape',
          blockType: BlockType.COMMAND,
          text: 'add hitbox shape [NAME] with data [DATA]',
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "my shape" },
            DATA: { type: ArgumentType.STRING, defaultValue: "0 0 0" },
          },
        },
        {
          opcode: 'shapeExists',
          blockType: BlockType.BOOLEAN,
          text: 'shape [NAME] exists?',
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "my shape" },
          },
        },
        {
          opcode: 'removeShape',
          blockType: BlockType.COMMAND,
          text: 'remove hitbox shape [NAME]',
          arguments: {
            NAME: { type: ArgumentType.STRING, menu: "shapes", defaultValue: "none" },
          },
        },
        {
          opcode: 'collisionMesh',
          blockType: BlockType.BOOLEAN,
          text: 'is sprite [Sprite1] touching sprite [Sprite2] by mesh?',
          arguments: {
            Sprite1: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
            Sprite2: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
          },
        },
        {
          opcode: 'collisionHitbox',
          blockType: BlockType.BOOLEAN,
          text: 'is hitbox [TAG1] of sprite [SPRITE1] colliding with hitbox [TAG2] of sprite [SPRITE2]?',
          arguments: {
            TAG1: { type: ArgumentType.STRING, defaultValue: "hitbox" },
            SPRITE1: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
            TAG2: { type: ArgumentType.STRING, defaultValue: "hitbox" },
            SPRITE2: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
          },
        },
        {
          opcode: 'hitboxesof',
          blockType: BlockType.REPORTER,
          text: 'hitboxes of [SPRITE]',
          arguments: {
            SPRITE: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
          },
        },
      ],
      menus: {
        shapes: {
          acceptReporters: true,
          items: "getShapes",
        },
        spriteMenu: {
          acceptReporters: true,
          items: "getSprites",
        },
      }
    };
  }

  createHitbox() {
    if (!is3DInitialized || is3DHidden) return;
    return '';
  }

  hitboxExists() {
    if (!is3DInitialized || is3DHidden) return false;
    return false;
  }

  deleteHitbox() {
    if (!is3DInitialized || is3DHidden) return;
    return '';
  }

  createShape() {
    if (!is3DInitialized || is3DHidden) return;
    return '';
  }

  shapeExists() {
    if (!is3DInitialized || is3DHidden) return false;
    return false;
  }

  removeShape() {
    if (!is3DInitialized || is3DHidden) return;
    return '';
  }

  collisionMesh() {
    if (!is3DInitialized || is3DHidden) return false;
    return false;
  }

  collisionHitbox() {
    if (!is3DInitialized || is3DHidden) return false;
    return false;
  }

  hitboxesof() {
    if (!is3DInitialized || is3DHidden) return JSON.stringify([]);
    return JSON.stringify([]);
  }

  getShapes() {
    if (!is3DInitialized || is3DHidden) return [{ text: "none", value: "none" }];
    return [{ text: "none", value: "none" }];
  }

  getSprites() {
    const spriteNames = [{ text: "myself", value: "myself" }];
    const targets = runtime.targets;
    for (let index = 1; index < targets.length; index++) {
      const target = targets[index];
      if (target.isOriginal && target.sprite) {
        spriteNames.push({
          text: target.sprite.name,
          value: target.sprite.name
        });
      }
    }
    return spriteNames.length > 1 ? spriteNames : [{ text: "myself", value: "myself" }];
  }
}

class ThreeCamera {
  constructor() {}

  getInfo() {
    return {
      id: 'Dragonian3DCamera',
      name: 'Camera 3D',
      color1: extcolors.Camera[0],
      color2: extcolors.Camera[1],
      color3: extcolors.Camera[2],
      blocks: [
        {
          opcode: "existingCameras",
          blockType: BlockType.REPORTER,
          text: "existing cameras",
        },
        {
          opcode: "camerasData",
          blockType: BlockType.REPORTER,
          text: "cameras data",
        },
        {
          opcode: "activeCamera",
          blockType: BlockType.REPORTER,
          text: "active camera",
        },
        {
          opcode: "createCamera",
          blockType: BlockType.COMMAND,
          text: "create [TYPE] camera [CAMERA]",
          arguments: {
            TYPE: { type: ArgumentType.STRING, menu: "cameraTypeMenu", defaultValue: "perspective" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera2" },
          },
        },
        {
          opcode: "cameraExists",
          blockType: BlockType.BOOLEAN,
          text: "camera [CAMERA] exists?",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera2" },
          },
        },
        {
          opcode: "deleteCamera",
          blockType: BlockType.COMMAND,
          text: "delete camera [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera2" },
          },
        },
        {
          opcode: "focusCamera",
          blockType: BlockType.COMMAND,
          text: "focus on camera [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
        {
          opcode: "moveCameraSteps",
          blockType: BlockType.COMMAND,
          text: "move camera [CAMERA] [STEPS] steps in 3D",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            STEPS: { type: ArgumentType.NUMBER, defaultValue: 10 },
          },
        },
        {
          opcode: "setCameraPosition",
          blockType: BlockType.COMMAND,
          text: "set camera position of [CAMERA] to x:[X] y:[Y] z:[Z]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "cameraXPosition",
          blockType: BlockType.REPORTER,
          text: "camera x position of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
        {
          opcode: "cameraYPosition",
          blockType: BlockType.REPORTER,
          text: "camera y position of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
        {
          opcode: "cameraZPosition",
          blockType: BlockType.REPORTER,
          text: "camera z position of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
        {
          opcode: "cameraPosition",
          blockType: BlockType.REPORTER,
          text: "camera position of [CAMERA] as [TYPE]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "changeCameraPosition",
          blockType: BlockType.COMMAND,
          text: "change camera position of [CAMERA] by x:[X] y:[Y] z:[Z]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "setCameraRotation",
          blockType: BlockType.COMMAND,
          text: "set camera rotation of [CAMERA] to r:[R] p:[P] y:[Y]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "cameraRoll",
          blockType: BlockType.REPORTER,
          text: "camera roll of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
        {
          opcode: "cameraPitch",
          blockType: BlockType.REPORTER,
          text: "camera pitch of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
        {
          opcode: "cameraYaw",
          blockType: BlockType.REPORTER,
          text: "camera yaw of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
        {
          opcode: "cameraRotation",
          blockType: BlockType.REPORTER,
          text: "camera rotation of [CAMERA] as [TYPE]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "changeCameraRotation",
          blockType: BlockType.COMMAND,
          text: "change camera rotation of [CAMERA] by r:[R] p:[P] y:[Y]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "setCameraPosMenu",
          blockType: BlockType.COMMAND,
          text: "set camera pos [POSTYPES] of [CAMERA] to [NUMBER]",
          arguments: {
            POSTYPES: { type: ArgumentType.STRING, menu: "postypes", defaultValue: "x" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "setCameraRotMenu",
          blockType: BlockType.COMMAND,
          text: "set camera rot [ROTTYPES] of [CAMERA] to [NUMBER]",
          arguments: {
            ROTTYPES: { type: ArgumentType.STRING, menu: "rottypes", defaultValue: "roll" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "cameraDirectionAround",
          blockType: BlockType.REPORTER,
          text: "camera direction around [ROTTYPES] of [CAMERA]",
          arguments: {
            ROTTYPES: { type: ArgumentType.STRING, menu: "rottypes", defaultValue: "roll" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
        {
          opcode: "setCameraPositionalOffset",
          blockType: BlockType.COMMAND,
          text: "set camera positional offset of [CAMERA] to x:[X] y:[Y] z:[Z]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "cameraPositionalOffset",
          blockType: BlockType.REPORTER,
          text: "camera [CAMERA] positional offset as [TYPE]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "setCameraRotationalOffset",
          blockType: BlockType.COMMAND,
          text: "set camera rotational offset of [CAMERA] to r:[R] p:[P] y:[Y]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
        },
        {
          opcode: "cameraRotationalOffset",
          blockType: BlockType.REPORTER,
          text: "camera [CAMERA] rotational offset as [TYPE]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "bindCamera",
          blockType: BlockType.COMMAND,
          text: "attach camera [CAMERA] to [SPRITE] with type [TYPE]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            SPRITE: { type: ArgumentType.STRING, menu: "spriteMenu", defaultValue: "" },
            TYPE: { type: ArgumentType.STRING, menu: "bindTypeMenu", defaultValue: "both" }
          },
        },
        {
          opcode: "bindedSprite",
          blockType: BlockType.REPORTER,
          text: "sprite camera [CAMERA] is attached to",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
        {
          opcode: "unbindCamera",
          blockType: BlockType.COMMAND,
          text: "detach camera [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
        {
          opcode: "setCameraVis",
          blockType: BlockType.COMMAND,
          text: "set camera [CAMVIS] of [CAMERA] to [NUMBER]",
          arguments: {
            CAMVIS: { type: ArgumentType.STRING, menu: "camvis", defaultValue: "vertical FOV" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 90 },
          },
        },
        {
          opcode: "getCameraVis",
          blockType: BlockType.REPORTER,
          text: "camera [CAMVIS] of [CAMERA]",
          arguments: {
            CAMVIS: { type: ArgumentType.STRING, menu: "camvis", defaultValue: "vertical FOV" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
        },
      ],
      menus: {
        cameraTypeMenu: {
          acceptReporters: true,
          items: ["perspective", "orthographic"]
        },
        spriteMenu: {
          acceptReporters: true,
          items: "getSprites",
        },
        postypes: {
          acceptReporters: true,
          items: ["x", "y", "z"],
        },
        rottypes: {
          acceptReporters: true,
          items: [{ text: "roll", value: "roll" }, { text: "pitch", value: "pitch" }, { text: "yaw", value: "yaw" }],
        },
        camvis: {
          acceptReporters: true,
          items: [{ text: "vertical FOV", value: "fov" }, { text: "minimum render distance", value: "minclip" }, { text: "maximum render distance", value: "maxclip" }],
        },
        bindTypeMenu: {
          acceptReporters: true,
          items: ["positional", "rotational", "both"]
        },
        dataTypeMenu: {
          acceptReporters: true,
          items: [{ text: "array", value: "array" }, { text: "object", value: "object" }]
        }
      },
    };
  }

  existingCameras() {
    if (!is3DInitialized || is3DHidden) return JSON.stringify(["camera"]);
    return JSON.stringify(Object.keys(cameras));
  }

  camerasData() {
    if (!is3DInitialized || is3DHidden) return JSON.stringify([{name: "camera", type: "perspective"}]);
    
    const cameraData = [];
    for (const name in cameras) {
      cameraData.push({
        name: name,
        type: cameras[name].userData.type || "perspective"
      });
    }
    return JSON.stringify(cameraData);
  }

  activeCamera() {
    if (!is3DInitialized || is3DHidden) return "";
    return activeCamera.name || "";
  }

  createCamera(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraType = Cast.toString(args.TYPE);
    const cameraName = Cast.toString(args.CAMERA);
    
    if (cameras[cameraName]) {
      console.warn(`Camera "${cameraName}" already exists`);
      return;
    }
    
    createCamera(cameraName, cameraType);
  }

  cameraExists(args) {
    if (!is3DInitialized || is3DHidden) return false;
    const cameraName = Cast.toString(args.CAMERA);
    return !!(cameras[cameraName]);
  }

  deleteCamera(args) {
    if (!is3DInitialized || is3DHidden) return;
    const cameraName = Cast.toString(args.CAMERA);
    deleteCamera(cameraName);
  }

  focusCamera(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    if (!cameras[cameraName]) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    activeCamera = cameras[cameraName];
    updateRenderer();
  }

  moveCameraSteps(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const steps = Cast.toNumber(args.STEPS);
    const angle = camera.rotation.y;
    const dx = Math.sin(angle) * steps;
    const dz = -Math.cos(angle) * steps;
    
    camera.position.x += dx;
    camera.position.z += dz;
    
    updateRenderer();
  }

  setCameraPosition(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    camera.position.set(x, y, z);
    
    updateRenderer();
  }

  cameraXPosition(args) {
    if (!is3DInitialized || is3DHidden) return '0';
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return '0';
    
    return camera.position.x.toString();
  }

  cameraYPosition(args) {
    if (!is3DInitialized || is3DHidden) return '0';
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return '0';
    
    return camera.position.y.toString();
  }

  cameraZPosition(args) {
    if (!is3DInitialized || is3DHidden) return '0';
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return '0';
    
    return camera.position.z.toString();
  }

  cameraPosition(args) {
    if (!is3DInitialized || is3DHidden) return JSON.stringify([0, 0, 0]);
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return JSON.stringify([0, 0, 0]);
    
    if (args.TYPE === "array") {
      return JSON.stringify([camera.position.x, camera.position.y, camera.position.z]);
    } else {
      return JSON.stringify({x: camera.position.x, y: camera.position.y, z: camera.position.z});
    }
  }

  changeCameraPosition(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    camera.position.x += x;
    camera.position.y += y;
    camera.position.z += z;
    
    updateRenderer();
  }

  setCameraRotation(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const roll = Cast.toNumber(args.R) * Math.PI / 180;
    const pitch = Cast.toNumber(args.P) * Math.PI / 180;
    const yaw = Cast.toNumber(args.Y) * Math.PI / 180;
    
    camera.rotation.set(pitch, yaw, roll);
    
    updateRenderer();
  }

  cameraRoll(args) {
    if (!is3DInitialized || is3DHidden) return '0';
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return '0';
    
    return (camera.rotation.z * 180 / Math.PI).toString();
  }

  cameraPitch(args) {
    if (!is3DInitialized || is3DHidden) return '0';
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return '0';
    
    return (camera.rotation.x * 180 / Math.PI).toString();
  }

  cameraYaw(args) {
    if (!is3DInitialized || is3DHidden) return '0';
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return '0';
    
    return (camera.rotation.y * 180 / Math.PI).toString();
  }

  cameraRotation(args) {
    if (!is3DInitialized || is3DHidden) return JSON.stringify([0, 0, 0]);
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return JSON.stringify([0, 0, 0]);
    
    const roll = camera.rotation.z * 180 / Math.PI;
    const pitch = camera.rotation.x * 180 / Math.PI;
    const yaw = camera.rotation.y * 180 / Math.PI;
    
    if (args.TYPE === "array") {
      return JSON.stringify([roll, pitch, yaw]);
    } else {
      return JSON.stringify({roll: roll, pitch: pitch, yaw: yaw});
    }
  }

  changeCameraRotation(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const roll = Cast.toNumber(args.R) * Math.PI / 180;
    const pitch = Cast.toNumber(args.P) * Math.PI / 180;
    const yaw = Cast.toNumber(args.Y) * Math.PI / 180;
    
    camera.rotation.x += pitch;
    camera.rotation.y += yaw;
    camera.rotation.z += roll;
    
    updateRenderer();
  }

  setCameraPosMenu(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const value = Cast.toNumber(args.NUMBER);
    
    switch (args.POSTYPES) {
      case "x":
        camera.position.x = value;
        break;
      case "y":
        camera.position.y = value;
        break;
      case "z":
        camera.position.z = value;
        break;
    }
    
    updateRenderer();
  }

  setCameraRotMenu(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const value = Cast.toNumber(args.NUMBER) * Math.PI / 180;
    
    if (args.ROTTYPES === "roll") {
      camera.rotation.z = value;
    } else if (args.ROTTYPES === "pitch") {
      camera.rotation.x = value;
    } else if (args.ROTTYPES === "yaw") {
      camera.rotation.y = value;
    }
    
    updateRenderer();
  }

  cameraDirectionAround(args) {
    if (!is3DInitialized || is3DHidden) return '0';
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return '0';
    
    let value;
    if (args.ROTTYPES === "roll") {
      value = camera.rotation.z * 180 / Math.PI;
    } else if (args.ROTTYPES === "pitch") {
      value = camera.rotation.x * 180 / Math.PI;
    } else if (args.ROTTYPES === "yaw") {
      value = camera.rotation.y * 180 / Math.PI;
    }
    
    return value.toString();
  }

  setCameraPositionalOffset(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    camera.userData.positionalOffset.set(x, y, z);
    updateRenderer();
  }

  cameraPositionalOffset(args) {
    if (!is3DInitialized || is3DHidden) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({x: 0, y: 0, z: 0});
    }
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({x: 0, y: 0, z: 0});
    }
    
    const offset = camera.userData.positionalOffset;
    
    if (args.TYPE === "array") {
      return JSON.stringify([offset.x, offset.y, offset.z]);
    } else {
      return JSON.stringify({x: offset.x, y: offset.y, z: offset.z});
    }
  }

  setCameraRotationalOffset(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const r = Cast.toNumber(args.R) * Math.PI / 180;
    const p = Cast.toNumber(args.P) * Math.PI / 180;
    const y = Cast.toNumber(args.Y) * Math.PI / 180;
    
    camera.userData.rotationalOffset.set(p, y, r, 'YXZ');
    updateRenderer();
  }

  cameraRotationalOffset(args) {
    if (!is3DInitialized || is3DHidden) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({roll: 0, pitch: 0, yaw: 0});
    }
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({roll: 0, pitch: 0, yaw: 0});
    }
    
    const offset = camera.userData.rotationalOffset;
    const roll = offset.z * 180 / Math.PI;
    const pitch = offset.x * 180 / Math.PI;
    const yaw = offset.y * 180 / Math.PI;
    
    if (args.TYPE === "array") {
      return JSON.stringify([roll, pitch, yaw]);
    } else {
      return JSON.stringify({roll: roll, pitch: pitch, yaw: yaw});
    }
  }

  bindCamera(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const spriteName = Cast.toString(args.SPRITE);
    const type = Cast.toString(args.TYPE);
    
    camera.userData.attachedTo = spriteName === "myself" ? runtime.currentSprite?.name : spriteName;
    camera.userData.attachmentType = type;
    
    updateRenderer();
  }

  bindedSprite(args) {
    if (!is3DInitialized || is3DHidden) return JSON.stringify('');
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return JSON.stringify('');
    
    return JSON.stringify(camera.userData.attachedTo || '');
  }

  unbindCamera(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    camera.userData.attachedTo = null;
    camera.userData.attachmentType = null;
    
    updateRenderer();
  }

  setCameraVis(args) {
    if (!is3DInitialized || is3DHidden) return;
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) {
      console.warn(`Camera "${cameraName}" does not exist`);
      return;
    }
    
    const value = Cast.toNumber(args.NUMBER);
    
    if (args.CAMVIS === "fov") {
      if (camera.isPerspectiveCamera) {
        camera.fov = Math.max(0.1, Math.min(value, 180));
        camera.updateProjectionMatrix();
      }
    } else if (args.CAMVIS === "minclip") {
      camera.near = Math.max(0.1, value);
      camera.updateProjectionMatrix();
    } else if (args.CAMVIS === "maxclip") {
      camera.far = Math.max(camera.near + 0.1, value);
      camera.updateProjectionMatrix();
    }
    
    updateRenderer();
  }

  getCameraVis(args) {
    if (!is3DInitialized || is3DHidden) return '0';
    
    const cameraName = Cast.toString(args.CAMERA);
    const camera = cameras[cameraName];
    if (!camera) return '0';
    
    if (args.CAMVIS === "fov") {
      if (camera.isPerspectiveCamera) {
        return camera.fov.toString();
      } else {
        return '0';
      }
    } else if (args.CAMVIS === "minclip") {
      return camera.near.toString();
    } else if (args.CAMVIS === "maxclip") {
      return camera.far.toString();
    }
    
    return '0';
  }

  getSprites() {
    const spriteNames = [{ text: "myself", value: "myself" }];
    const targets = runtime.targets;
    for (let index = 1; index < targets.length; index++) {
      const target = targets[index];
      if (target.isOriginal && target.sprite) {
        spriteNames.push({
          text: target.sprite.name,
          value: target.sprite.name
        });
      }
    }
    return spriteNames.length > 1 ? spriteNames : [{ text: "myself", value: "myself" }];
  }
}

class ThreeOperators {
  constructor() {}

  getInfo() {
    return {
      id: 'Dragonian3DOperators',
      name: 'Operators 3D',
      color1: extcolors.Operators[0],
      color2: extcolors.Operators[1],
      color3: extcolors.Operators[2],
      blocks: [
        {
          opcode: "vectorAdd",
          blockType: BlockType.REPORTER,
          text: "vector x1:[X1] y1:[Y1] z1:[Z1] + vector x2:[X2] y2:[Y2] z2:[Z2] as [TYPE]",
          arguments: {
            X1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            X2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "vectorSubtract",
          blockType: BlockType.REPORTER,
          text: "vector x1:[X1] y1:[Y1] z1:[Z1] - vector x2:[X2] y2:[Y2] z2:[Z2] as [TYPE]",
          arguments: {
            X1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            X2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "vectorMultiply",
          blockType: BlockType.REPORTER,
          text: "vector x:[X] y:[Y] z:[Z] * scalar [SCALAR] as [TYPE]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
            SCALAR: { type: ArgumentType.NUMBER, defaultValue: 1 },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "vectorDivide",
          blockType: BlockType.REPORTER,
          text: "vector x:[X] y:[Y] z:[Z] / scalar [SCALAR] as [TYPE]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
            SCALAR: { type: ArgumentType.NUMBER, defaultValue: 1 },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "vectorDistance",
          blockType: BlockType.REPORTER,
          text: "distance between x1:[X1] y1:[Y1] z1:[Z1] and x2:[X2] y2:[Y2] z2:[Z2]",
          arguments: {
            X1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            X2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z2: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
        },
        {
          opcode: "vectorLength",
          blockType: BlockType.REPORTER,
          text: "length of vector x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
        },
        {
          opcode: "vectorNormalize",
          blockType: BlockType.REPORTER,
          text: "normalized vector x:[X] y:[Y] z:[Z] as [TYPE]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "vectorDot",
          blockType: BlockType.REPORTER,
          text: "dot product of x1:[X1] y1:[Y1] z1:[Z1] and x2:[X2] y2:[Y2] z2:[Z2]",
          arguments: {
            X1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            X2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z2: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
        },
        {
          opcode: "vectorCross",
          blockType: BlockType.REPORTER,
          text: "cross product of x1:[X1] y1:[Y1] z1:[Z1] and x2:[X2] y2:[Y2] z2:[Z2] as [TYPE]",
          arguments: {
            X1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            X2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
        {
          opcode: "vectorLerp",
          blockType: BlockType.REPORTER,
          text: "lerp between x1:[X1] y1:[Y1] z1:[Z1] and x2:[X2] y2:[Y2] z2:[Z2] by [T] as [TYPE]",
          arguments: {
            X1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            X2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            T: { type: ArgumentType.NUMBER, defaultValue: 0.5 },
            TYPE: { type: ArgumentType.STRING, menu: "dataTypeMenu", defaultValue: "array" }
          },
        },
      ],
      menus: {
        dataTypeMenu: {
          acceptReporters: true,
          items: [{ text: "array", value: "array" }, { text: "object", value: "object" }]
        }
      },
    };
  }

  vectorAdd(args) {
    const x1 = Cast.toNumber(args.X1);
    const y1 = Cast.toNumber(args.Y1);
    const z1 = Cast.toNumber(args.Z1);
    const x2 = Cast.toNumber(args.X2);
    const y2 = Cast.toNumber(args.Y2);
    const z2 = Cast.toNumber(args.Z2);
    
    const resultX = x1 + x2;
    const resultY = y1 + y2;
    const resultZ = z1 + z2;
    
    if (args.TYPE === "array") {
      return JSON.stringify([resultX, resultY, resultZ]);
    } else {
      return JSON.stringify({x: resultX, y: resultY, z: resultZ});
    }
  }

  vectorSubtract(args) {
    const x1 = Cast.toNumber(args.X1);
    const y1 = Cast.toNumber(args.Y1);
    const z1 = Cast.toNumber(args.Z1);
    const x2 = Cast.toNumber(args.X2);
    const y2 = Cast.toNumber(args.Y2);
    const z2 = Cast.toNumber(args.Z2);
    
    const resultX = x1 - x2;
    const resultY = y1 - y2;
    const resultZ = z1 - z2;
    
    if (args.TYPE === "array") {
      return JSON.stringify([resultX, resultY, resultZ]);
    } else {
      return JSON.stringify({x: resultX, y: resultY, z: resultZ});
    }
  }

  vectorMultiply(args) {
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    const scalar = Cast.toNumber(args.SCALAR);
    
    const resultX = x * scalar;
    const resultY = y * scalar;
    const resultZ = z * scalar;
    
    if (args.TYPE === "array") {
      return JSON.stringify([resultX, resultY, resultZ]);
    } else {
      return JSON.stringify({x: resultX, y: resultY, z: resultZ});
    }
  }

  vectorDivide(args) {
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    const scalar = Cast.toNumber(args.SCALAR);
    
    if (scalar === 0) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({x: 0, y: 0, z: 0});
    }
    
    const resultX = x / scalar;
    const resultY = y / scalar;
    const resultZ = z / scalar;
    
    if (args.TYPE === "array") {
      return JSON.stringify([resultX, resultY, resultZ]);
    } else {
      return JSON.stringify({x: resultX, y: resultY, z: resultZ});
    }
  }

  vectorDistance(args) {
    const x1 = Cast.toNumber(args.X1);
    const y1 = Cast.toNumber(args.Y1);
    const z1 = Cast.toNumber(args.Z1);
    const x2 = Cast.toNumber(args.X2);
    const y2 = Cast.toNumber(args.Y2);
    const z2 = Cast.toNumber(args.Z2);
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    return distance.toString();
  }

  vectorLength(args) {
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    const length = Math.sqrt(x * x + y * y + z * z);
    return length.toString();
  }

  vectorNormalize(args) {
    const x = Cast.toNumber(args.X);
    const y = Cast.toNumber(args.Y);
    const z = Cast.toNumber(args.Z);
    
    const length = Math.sqrt(x * x + y * y + z * z);
    
    if (length === 0) {
      if (args.TYPE === "array") return JSON.stringify([0, 0, 0]);
      else return JSON.stringify({x: 0, y: 0, z: 0});
    }
    
    const resultX = x / length;
    const resultY = y / length;
    const resultZ = z / length;
    
    if (args.TYPE === "array") {
      return JSON.stringify([resultX, resultY, resultZ]);
    } else {
      return JSON.stringify({x: resultX, y: resultY, z: resultZ});
    }
  }

  vectorDot(args) {
    const x1 = Cast.toNumber(args.X1);
    const y1 = Cast.toNumber(args.Y1);
    const z1 = Cast.toNumber(args.Z1);
    const x2 = Cast.toNumber(args.X2);
    const y2 = Cast.toNumber(args.Y2);
    const z2 = Cast.toNumber(args.Z2);
    
    const dot = (x1 * x2) + (y1 * y2) + (z1 * z2);
    return dot.toString();
  }

  vectorCross(args) {
    const x1 = Cast.toNumber(args.X1);
    const y1 = Cast.toNumber(args.Y1);
    const z1 = Cast.toNumber(args.Z1);
    const x2 = Cast.toNumber(args.X2);
    const y2 = Cast.toNumber(args.Y2);
    const z2 = Cast.toNumber(args.Z2);
    
    const resultX = (y1 * z2) - (z1 * y2);
    const resultY = (z1 * x2) - (x1 * z2);
    const resultZ = (x1 * y2) - (y1 * x2);
    
    if (args.TYPE === "array") {
      return JSON.stringify([resultX, resultY, resultZ]);
    } else {
      return JSON.stringify({x: resultX, y: resultY, z: resultZ});
    }
  }

  vectorLerp(args) {
    const x1 = Cast.toNumber(args.X1);
    const y1 = Cast.toNumber(args.Y1);
    const z1 = Cast.toNumber(args.Z1);
    const x2 = Cast.toNumber(args.X2);
    const y2 = Cast.toNumber(args.Y2);
    const z2 = Cast.toNumber(args.Z2);
    const t = Cast.toNumber(args.T);
    
    const resultX = x1 + (x2 - x1) * t;
    const resultY = y1 + (y2 - y1) * t;
    const resultZ = z1 + (z2 - z1) * t;
    
    if (args.TYPE === "array") {
      return JSON.stringify([resultX, resultY, resultZ]);
    } else {
      return JSON.stringify({x: resultX, y: resultY, z: resultZ});
    }
  }
}

class ThreePen {
  constructor() {}

  getInfo() {
    return {
      id: 'Dragonian3DPen',
      name: 'Pen 3D',
      color1: extcolors.Pen[0],
      color2: extcolors.Pen[1],
      color3: extcolors.Pen[2],
      blocks: [
        {
          opcode: 'penDown3D',
          blockType: BlockType.COMMAND,
          text: '3D pen down',
        },
        {
          opcode: 'isPenDown3D',
          blockType: BlockType.BOOLEAN,
          text: 'is 3D pen down?',
        },
        {
          opcode: 'penUp3D',
          blockType: BlockType.COMMAND,
          text: '3D pen up',
        },
        {
          opcode: 'setPenColor3D',
          blockType: BlockType.COMMAND,
          text: 'set 3D pen color to [COLOR]',
          arguments: {
            COLOR: { type: ArgumentType.COLOR, defaultValue: '#000000' }
          },
        },
        {
          opcode: 'getPenColor3D',
          blockType: BlockType.REPORTER,
          text: '3D pen color',
        },
        {
          opcode: 'changePenColor3D',
          blockType: BlockType.COMMAND,
          text: 'change 3D pen color by [VALUE]',
          arguments: {
            VALUE: { type: ArgumentType.NUMBER, defaultValue: 10 }
          },
        },
        {
          opcode: 'setPenSize3D',
          blockType: BlockType.COMMAND,
          text: 'set 3D pen size to [SIZE]',
          arguments: {
            SIZE: { type: ArgumentType.NUMBER, defaultValue: 1 }
          },
        },
        {
          opcode: 'getPenSize3D',
          blockType: BlockType.REPORTER,
          text: '3D pen size',
        },
        {
          opcode: 'changePenSize3D',
          blockType: BlockType.COMMAND,
          text: 'change 3D pen size by [SIZE]',
          arguments: {
            SIZE: { type: ArgumentType.NUMBER, defaultValue: 1 }
          },
        },
        {
          opcode: 'setPenMaterial3D',
          blockType: BlockType.COMMAND,
          text: 'set material of 3D pen to [MATERIAL]',
          arguments: {
            MATERIAL: { type: ArgumentType.STRING, defaultValue: "basic" }
          },
        },
        {
          opcode: 'getPenMaterial3D',
          blockType: BlockType.REPORTER,
          text: '3D pen material',
        },
        {
          opcode: 'setPenBrush3D',
          blockType: BlockType.COMMAND,
          text: 'set 3D pen brush to [BRUSH]',
          arguments: {
            BRUSH: { type: ArgumentType.STRING, menu: "brushMenu", defaultValue: "brush" }
          },
        },
        {
          opcode: 'getPenBrush3D',
          blockType: BlockType.REPORTER,
          text: '3D pen brush',
        },
        {
          opcode: 'stamp3D',
          blockType: BlockType.COMMAND,
          text: '3D stamp',
        },
        {
          opcode: 'clear3D',
          blockType: BlockType.COMMAND,
          text: 'clear 3D drawings',
        },
        {
          opcode: 'drawShape3D',
          blockType: BlockType.COMMAND,
          text: 'draw [SHAPE] with width: [WIDTH] height: [HEIGHT] depth [DEPTH] at x: [X] y: [Y] z: [Z] with roll [ROLL] pitch: [PITCH] yaw: [YAW]',
          arguments: {
            SHAPE: { type: ArgumentType.STRING, menu: "shapeMenu", defaultValue: "box" },
            WIDTH: { type: ArgumentType.NUMBER, defaultValue: 100 },
            HEIGHT: { type: ArgumentType.NUMBER, defaultValue: 100 },
            DEPTH: { type: ArgumentType.NUMBER, defaultValue: 100 },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
            ROLL: { type: ArgumentType.NUMBER, defaultValue: 0 },
            PITCH: { type: ArgumentType.NUMBER, defaultValue: 0 },
            YAW: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
        },
        {
          opcode: 'stamp2DImage3D',
          blockType: BlockType.COMMAND,
          text: 'stamp 2d image with width: [WIDTH] height: [HEIGHT] depth [DEPTH] at x: [X] y: [Y] z: [Z] with roll [ROLL] pitch: [PITCH] yaw: [YAW]',
          arguments: {
            WIDTH: { type: ArgumentType.NUMBER, defaultValue: 100 },
            HEIGHT: { type: ArgumentType.NUMBER, defaultValue: 100 },
            DEPTH: { type: ArgumentType.NUMBER, defaultValue: 1 },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
            ROLL: { type: ArgumentType.NUMBER, defaultValue: 0 },
            PITCH: { type: ArgumentType.NUMBER, defaultValue: 0 },
            YAW: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
        },
        {
          opcode: 'setPenShade3D',
          blockType: BlockType.COMMAND,
          text: 'set 3D pen shade to [SHADE]',
          arguments: {
            SHADE: { type: ArgumentType.NUMBER, defaultValue: 50 }
          },
        },
        {
          opcode: 'getPenShade3D',
          blockType: BlockType.REPORTER,
          text: '3D pen shade',
        },
        {
          opcode: 'changePenShade3D',
          blockType: BlockType.COMMAND,
          text: 'change 3D pen shade by [SHADE]',
          arguments: {
            SHADE: { type: ArgumentType.NUMBER, defaultValue: 10 }
          },
        },
        {
          opcode: 'setPenTransparency3D',
          blockType: BlockType.COMMAND,
          text: 'set 3D pen transparency to [ALPHA]',
          arguments: {
            ALPHA: { type: ArgumentType.NUMBER, defaultValue: 100 }
          },
        },
        {
          opcode: 'getPenTransparency3D',
          blockType: BlockType.REPORTER,
          text: '3D pen transparency',
        },
      ],
      menus: {
        shapeMenu: {
          acceptReporters: true,
          items: ["box", "sphere", "cylinder", "cone", "plane", "torus"]
        },
        brushMenu: {
          acceptReporters: true,
          items: ["brush", "flat", "triangular"]
        }
      }
    };
  }

  penDown3D() {
    if (!is3DInitialized || is3DHidden) return;
    pen3DState.isDown = true;
    return '';
  }

  isPenDown3D() {
    return pen3DState.isDown;
  }

  penUp3D() {
    pen3DState.isDown = false;
    return '';
  }

  setPenColor3D(args) {
    pen3DState.color = Cast.toString(args.COLOR);
    return '';
  }

  getPenColor3D() {
    return pen3DState.color;
  }

  changePenColor3D() {
    return '';
  }

  setPenSize3D(args) {
    pen3DState.size = Cast.toNumber(args.SIZE);
    return '';
  }

  getPenSize3D() {
    return pen3DState.size.toString();
  }

  changePenSize3D(args) {
    pen3DState.size += Cast.toNumber(args.SIZE);
    return '';
  }

  setPenMaterial3D(args) {
    pen3DState.material = Cast.toString(args.MATERIAL);
    return '';
  }

  getPenMaterial3D() {
    return pen3DState.material;
  }

  setPenBrush3D(args) {
    pen3DState.brush = Cast.toString(args.BRUSH);
    return '';
  }

  getPenBrush3D() {
    return pen3DState.brush;
  }

  stamp3D() {
    if (!is3DInitialized || is3DHidden) return;
    return '';
  }

  clear3D() {
    if (!is3DInitialized || is3DHidden) return;
    return '';
  }

  drawShape3D() {
    if (!is3DInitialized || is3DHidden) return;
    return '';
  }

  stamp2DImage3D() {
    if (!is3DInitialized || is3DHidden) return;
    return '';
  }

  setPenShade3D(args) {
    pen3DState.shade = Cast.toNumber(args.SHADE);
    return '';
  }

  getPenShade3D() {
    return pen3DState.shade.toString();
  }

  changePenShade3D(args) {
    pen3DState.shade += Cast.toNumber(args.SHADE);
    return '';
  }

  setPenTransparency3D(args) {
    pen3DState.transparency = Cast.toNumber(args.ALPHA);
    return '';
  }

  getPenTransparency3D() {
    return pen3DState.transparency.toString();
  }
}

Scratch.extensions.register(new ThreeBase());
Scratch.extensions.register(new ThreeMotion());
Scratch.extensions.register(new ThreeLooks());
Scratch.extensions.register(new ThreeLighting());
Scratch.extensions.register(new ThreeSound());
Scratch.extensions.register(new ThreeEvents());
Scratch.extensions.register(new ThreeControl());
Scratch.extensions.register(new ThreeSensing());
Scratch.extensions.register(new ThreeCamera());
Scratch.extensions.register(new ThreeOperators());
Scratch.extensions.register(new ThreePen());

})(Scratch);
