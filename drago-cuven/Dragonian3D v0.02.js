(async function (Scratch) {
  const extID = "DragoThree";
  const extName = "3D";
  
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
    Lighting: ["#ae8800ff", "#836d1fff", "#0000ff"],
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
  const loadedTextures = {};
  
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

  let penGroup = null;

  class DragoThree {
    constructor() {
      this.scene = null;
      this.showCategory = {
        motion: false,
        looks: false,
        lighting: false,
        sound: false,
        events: false,
        control: false,
        sensing: false,
        camera: false,
        operators: false,
        pen: false
      };
    }

    reloadBlocks() {
      if (Scratch.vm && Scratch.vm.extensionManager) {
        Scratch.vm.extensionManager.refreshBlocks();
      }
    }

    getInfo() {
      return {
        id: extID,
        name: extName,
        color1: extcolors.Three[0],
        color2: extcolors.Three[1],
        color3: extcolors.Three[2],
        blocks: this.getBlocks(),
        menus: {
          threeBase_onOffMenu: {
            acceptReporters: true,
            items: ['on', 'off', 'hide']
          },
          threeMotion_postypes: {
            acceptReporters: true,
            items: ["x", "y", "z"],
          },
          threeMotion_rottypes: {
            acceptReporters: true,
            items: [{ text: "roll", value: "roll" }, { text: "pitch", value: "pitch" }, { text: "yaw", value: "yaw" }],
          },
          threeMotion_turndirs: {
            acceptReporters: true,
            items: ["up", "down", "left", "right"],
          },
          threeMotion_dataTypeMenu: {
            acceptReporters: true,
            items: [{ text: "array", value: "array" }, { text: "object", value: "object" }]
          },
          threeLooks_MODE_MENU: {
            acceptReporters: true,
            items: ["disabled", "model", "flat", "flat triangle", "cube", "sphere", "low-poly sphere"],
          },
          threeLooks_modelTypeMenu: {
            acceptReporters: true,
            items: ["OBJ", "GLTF", "GLB"]
          },
          threeLooks_texturefilter: {
            acceptReporters: true,
            items: ["nearest", "linear"],
          },
          threeLooks_showfaces: {
            acceptReporters: true,
            items: ["both", "front", "back"],
          },
          threeLooks_postypes: {
            acceptReporters: true,
            items: ["x", "y", "z"],
          },
          threeLooks_dataTypeMenu: {
            acceptReporters: true,
            items: [{ text: "array", value: "array" }, { text: "object", value: "object" }]
          },
          threeLooks_listsMenu: {
            acceptReporters: true,
            items: "getLists"
          },
          threeLooks_materialProperties: {
            acceptReporters: true,
            items: ["color", "emissive", "roughness", "metalness", "transparency", "shininess"]
          },
          threeLighting_lightDepMenu: {
            acceptReporters: true,
            items: [{ text: "light dependent", value: "ld" }, { text: "light independent", value: "lid" }]
          },
          threeLighting_lightTypes: {
            acceptReporters: true,
            items: ["ambient", "directional", "point", "spot", "hemisphere"]
          },
          threeLighting_spriteMenu: {
            acceptReporters: true,
            items: "getSprites",
          },
          threeLighting_bindTypeMenu: {
            acceptReporters: true,
            items: ["positional", "rotational", "both"]
          },
          threeLighting_dataTypeMenu: {
            acceptReporters: true,
            items: [{ text: "array", value: "array" }, { text: "object", value: "object" }]
          },
          threeSensing_shapes: {
            acceptReporters: true,
            items: "getShapes",
          },
          threeSensing_spriteMenu: {
            acceptReporters: true,
            items: "getSprites",
          },
          threeCamera_cameraTypeMenu: {
            acceptReporters: true,
            items: ["perspective", "orthographic"]
          },
          threeCamera_spriteMenu: {
            acceptReporters: true,
            items: "getSprites",
          },
          threeCamera_postypes: {
            acceptReporters: true,
            items: ["x", "y", "z"],
          },
          threeCamera_rottypes: {
            acceptReporters: true,
            items: [{ text: "roll", value: "roll" }, { text: "pitch", value: "pitch" }, { text: "yaw", value: "yaw" }],
          },
          threeCamera_camvis: {
            acceptReporters: true,
            items: [{ text: "vertical FOV", value: "fov" }, { text: "minimum render distance", value: "minclip" }, { text: "maximum render distance", value: "maxclip" }],
          },
          threeCamera_bindTypeMenu: {
            acceptReporters: true,
            items: ["positional", "rotational", "both"]
          },
          threeCamera_dataTypeMenu: {
            acceptReporters: true,
            items: [{ text: "array", value: "array" }, { text: "object", value: "object" }]
          },
          threeOperators_dataTypeMenu: {
            acceptReporters: true,
            items: [{ text: "array", value: "array" }, { text: "object", value: "object" }]
          },
          threePen_shapeMenu: {
            acceptReporters: true,
            items: ["box", "sphere", "cylinder", "cone", "plane", "torus"]
          },
          threePen_brushMenu: {
            acceptReporters: true,
            items: ["brush", "flat", "triangular"]
          },
          threeOperators_vectorComponents: {
            acceptReporters: true,
            items: ["w", "x", "y", "z"]
          }
        },
      };
    }

    getBlocks() {
      const baseBlocks = [
        {
          opcode: "threeBase_isOn",
          blockType: BlockType.BOOLEAN,
          text: "3D on?",
          color1: extcolors.Three[0],
          color2: extcolors.Three[1],
          color3: extcolors.Three[2],
        },
        {
          opcode: "threeBase_setEnabled",
          blockType: BlockType.COMMAND,
          text: "set 3D to [ENABLED]",
          arguments: {
            ENABLED: { 
              type: ArgumentType.STRING,
              menu: 'threeBase_onOffMenu',
              defaultValue: 'ON'
            },
          },
          color1: extcolors.Three[0],
          color2: extcolors.Three[1],
          color3: extcolors.Three[2],
        },
        {
          opcode: "threeBase_getEnabled",
          blockType: BlockType.REPORTER,
          text: "3D enabled",
          color1: extcolors.Three[0],
          color2: extcolors.Three[1],
          color3: extcolors.Three[2],
        },
        {
          opcode: "threeBase_getView",
          blockType: BlockType.REPORTER,
          text: "3D view",
          color1: extcolors.Three[0],
          color2: extcolors.Three[1],
          color3: extcolors.Three[2],
        },
        {
          opcode: "threeBase_setSkyboxColor",
          blockType: BlockType.COMMAND,
          text: "set skybox to color [COLOR]",
          arguments: {
            COLOR: { 
              type: ArgumentType.COLOR, 
              defaultValue: "#ffffff" 
            },
          },
          color1: extcolors.Three[0],
          color2: extcolors.Three[1],
          color3: extcolors.Three[2],
        },
        {
          opcode: "threeBase_getSkyboxColor",
          blockType: BlockType.REPORTER,
          text: "skybox color",
          color1: extcolors.Three[0],
          color2: extcolors.Three[1],
          color3: extcolors.Three[2],
        }
      ];

      const motionBlocks = [
        {
          opcode: "threeMotion_moveSteps",
          blockType: BlockType.COMMAND,
          text: "move [STEPS] steps in 3D",
          arguments: {
            STEPS: { type: ArgumentType.NUMBER, defaultValue: 10 },
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_setPosition",
          blockType: BlockType.COMMAND,
          text: "set position to x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_xPosition",
          blockType: BlockType.REPORTER,
          text: "x position",
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_yPosition",
          blockType: BlockType.REPORTER,
          text: "y position",
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_zPosition",
          blockType: BlockType.REPORTER,
          text: "z position",
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_changePosition",
          blockType: BlockType.COMMAND,
          text: "change position by x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_setRotation",
          blockType: BlockType.COMMAND,
          text: "set rotation to r:[R] p:[P] y:[Y]",
          arguments: {
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_roll",
          blockType: BlockType.REPORTER,
          text: "roll",
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_pitch",
          blockType: BlockType.REPORTER,
          text: "pitch",
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_yaw",
          blockType: BlockType.REPORTER,
          text: "yaw",
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_changeRotation",
          blockType: BlockType.COMMAND,
          text: "change rotation by r:[R] p:[P] y:[Y]",
          arguments: {
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_setPosMenu",
          blockType: BlockType.COMMAND,
          text: "set pos [POSTYPES] to [NUMBER]",
          arguments: {
            POSTYPES: { type: ArgumentType.STRING, menu: "threeMotion_postypes", defaultValue: "x" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_setRotMenu",
          blockType: BlockType.COMMAND,
          text: "set rot [ROTTYPES] to [NUMBER]",
          arguments: {
            ROTTYPES: { type: ArgumentType.STRING, menu: "threeMotion_rottypes", defaultValue: "roll" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_directionAround",
          blockType: BlockType.REPORTER,
          text: "direction around [ROTTYPES]",
          arguments: {
            ROTTYPES: { type: ArgumentType.STRING, menu: "threeMotion_rottypes", defaultValue: "roll" },
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_position",
          blockType: BlockType.REPORTER,
          text: "position as [TYPE]",
          arguments: {
            TYPE: { type: ArgumentType.STRING, menu: "threeMotion_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_rotation",
          blockType: BlockType.REPORTER,
          text: "rotation as [TYPE]",
          arguments: {
            TYPE: { type: ArgumentType.STRING, menu: "threeMotion_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_turnDegrees",
          blockType: BlockType.COMMAND,
          text: "turn [TURNDIRS] [NUM] degrees",
          arguments: {
            TURNDIRS: { type: ArgumentType.STRING, menu: "threeMotion_turndirs", defaultValue: "up" },
            NUM: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        },
        {
          opcode: "threeMotion_direction",
          blockType: BlockType.REPORTER,
          text: "direction",
          color1: extcolors.Motion[0],
          color2: extcolors.Motion[1],
          color3: extcolors.Motion[2],
          hideFromPalette: !this.showCategory.motion
        }
      ];

      const looksBlocks = [
        {
          opcode: "threeLooks_existingModels",
          blockType: BlockType.REPORTER,
          text: "existing models",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_existingMaterials",
          blockType: BlockType.REPORTER,
          text: "existing materials",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_existingTextures",
          blockType: BlockType.REPORTER,
          text: "existing textures",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_spriteMode",
          blockType: BlockType.REPORTER,
          text: "sprite mode",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_flatLayers",
          blockType: BlockType.REPORTER,
          text: "flat mode layers",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_setMode",
          blockType: BlockType.COMMAND,
          text: "set sprite mode to [MODE]",
          arguments: {
            MODE: {
              type: ArgumentType.STRING,
              menu: "threeLooks_MODE_MENU",
              defaultValue: "disabled",
            },
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_setFlatLayers",
          blockType: BlockType.COMMAND,
          text: "set flat mode layers to [LAYERS]",
          arguments: {
            LAYERS: { type: ArgumentType.NUMBER, defaultValue: 1 }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_setModel",
          blockType: BlockType.COMMAND,
          text: "set model to [MODEL]",
          arguments: {
            MODEL: { type: ArgumentType.STRING, defaultValue: "" },
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_currentModel",
          blockType: BlockType.REPORTER,
          text: "current model",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_createModelFromString",
          blockType: BlockType.COMMAND,
          text: "create model named [NAME] from data [STRINGDATA] as type [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "new model" },
            STRINGDATA: { type: ArgumentType.STRING, defaultValue: "" },
            TYPE: { type: ArgumentType.STRING, menu: "threeLooks_modelTypeMenu", defaultValue: "OBJ" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_createModelFromList",
          blockType: BlockType.COMMAND,
          text: "create model named [NAME] from list [LIST] as type [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "new model" },
            LIST: { type: ArgumentType.STRING, menu: "threeLooks_listsMenu", defaultValue: "" },
            TYPE: { type: ArgumentType.STRING, menu: "threeLooks_modelTypeMenu", defaultValue: "OBJ" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_deletemodel",
          blockType: BlockType.COMMAND,
          text: "delete model [MODEL]",
          arguments: {
            MODEL: { type: ArgumentType.STRING, defaultValue: "" },
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_setTextureFilter",
          blockType: BlockType.COMMAND,
          text: "set texture filter to [TEXTUREFILTER]",
          arguments: {
            TEXTUREFILTER: { type: ArgumentType.STRING, menu: "threeLooks_texturefilter", defaultValue: "nearest" },
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_getTextureFilter",
          blockType: BlockType.REPORTER,
          text: "texture filter",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_showFaces",
          blockType: BlockType.COMMAND,
          text: "show faces [SHOWFACES] of myself",
          arguments: {
            SHOWFACES: { type: ArgumentType.STRING, menu: "threeLooks_showfaces", defaultValue: "both" },
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_getShowFaces",
          blockType: BlockType.REPORTER,
          text: "show faces",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_set3DStretch",
          blockType: BlockType.COMMAND,
          text: "set 3D stretch to x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 100 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 100 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 100 },
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_stretchX",
          blockType: BlockType.REPORTER,
          text: "3D stretch x",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_stretchY",
          blockType: BlockType.REPORTER,
          text: "3D stretch y",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_stretchZ",
          blockType: BlockType.REPORTER,
          text: "3D stretch z",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_change3DStretch",
          blockType: BlockType.COMMAND,
          text: "change 3D stretch by x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_set3DStretchMenu",
          blockType: BlockType.COMMAND,
          text: "set 3D stretch [POSTYPES] to [NUMBER]",
          arguments: {
            POSTYPES: { type: ArgumentType.STRING, menu: "threeLooks_postypes", defaultValue: "x" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 100 },
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_change3DStretchMenu",
          blockType: BlockType.COMMAND,
          text: "change 3D stretch [POSTYPES] by [NUMBER]",
          arguments: {
            POSTYPES: { type: ArgumentType.STRING, menu: "threeLooks_postypes", defaultValue: "x" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_stretches",
          blockType: BlockType.REPORTER,
          text: "3D stretches as [TYPE]",
          arguments: {
            TYPE: { type: ArgumentType.STRING, menu: "threeLooks_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_setModelMaterial",
          blockType: BlockType.COMMAND,
          text: "set model material to [MATERIAL]",
          arguments: {
            MATERIAL: { type: ArgumentType.STRING, defaultValue: "basic" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_currentMaterial",
          blockType: BlockType.REPORTER,
          text: "current material",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_resetMaterial",
          blockType: BlockType.COMMAND,
          text: "reset material",
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_addMaterial",
          blockType: BlockType.COMMAND,
          text: "add material named [NAME] from texture: [TEXTURE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "new material" },
            TEXTURE: { type: ArgumentType.STRING, defaultValue: "" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_removeMaterial",
          blockType: BlockType.COMMAND,
          text: "remove material [MATERIAL]",
          arguments: {
            MATERIAL: { type: ArgumentType.STRING, defaultValue: "" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_addTexture",
          blockType: BlockType.COMMAND,
          text: "add texture named: [NAME] from texture: [DATA]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "new texture" },
            DATA: { type: ArgumentType.STRING, defaultValue: "" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_deleteTexture",
          blockType: BlockType.COMMAND,
          text: "delete texture named: [NAME]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_getTexture",
          blockType: BlockType.REPORTER,
          text: "texture [NAME]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_materialExists",
          blockType: BlockType.BOOLEAN,
          text: "material [NAME] exists?",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_getMaterial",
          blockType: BlockType.REPORTER,
          text: "material [NAME]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        },
        {
          opcode: "threeLooks_setMaterialProperty",
          blockType: BlockType.COMMAND,
          text: "set material [MATERIAL] property [PROPERTY] to [VALUE]",
          arguments: {
            MATERIAL: { type: ArgumentType.STRING, defaultValue: "" },
            PROPERTY: { type: ArgumentType.STRING, menu: "threeLooks_materialProperties", defaultValue: "color" },
            VALUE: { type: ArgumentType.STRING, defaultValue: "#ffffff" }
          },
          color1: extcolors.Looks[0],
          color2: extcolors.Looks[1],
          color3: extcolors.Looks[2],
          hideFromPalette: !this.showCategory.looks
        }
      ];

      const lightingBlocks = [
        {
          opcode: "threeLighting_setLightDependency",
          blockType: BlockType.COMMAND,
          text: "make [SPRITE] [LIGHTDEPEDENCY]",
          arguments: {
            SPRITE: { type: ArgumentType.STRING, menu: "threeLighting_spriteMenu", defaultValue: "" },
            LIGHTDEPEDENCY: { type: ArgumentType.STRING, menu: "threeLighting_lightDepMenu", defaultValue: "lid" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_getLightDependency",
          blockType: BlockType.REPORTER,
          text: "light dependency of [SPRITE]",
          arguments: {
            SPRITE: { type: ArgumentType.STRING, menu: "threeLighting_spriteMenu", defaultValue: "" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_existingLights",
          blockType: BlockType.REPORTER,
          text: "existing lights",
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_lightsData",
          blockType: BlockType.REPORTER,
          text: "lights data",
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_createLight",
          blockType: BlockType.COMMAND,
          text: "create [TYPE] light named [NAME]",
          arguments: {
            TYPE: { type: ArgumentType.STRING, menu: "threeLighting_lightTypes", defaultValue: "ambient" },
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_lightExists",
          blockType: BlockType.BOOLEAN,
          text: "light [NAME] exists?",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_deleteLight",
          blockType: BlockType.COMMAND,
          text: "delete light [NAME]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_setLightPosition",
          blockType: BlockType.COMMAND,
          text: "set light [NAME] position to x:[X] y:[Y] z:[Z]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_lightPosition",
          blockType: BlockType.REPORTER,
          text: "light [NAME] position as [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            TYPE: { type: ArgumentType.STRING, menu: "threeLighting_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_changeLightPosition",
          blockType: BlockType.COMMAND,
          text: "change light [NAME] position by x:[X] y:[Y] z:[Z]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_setLightRotation",
          blockType: BlockType.COMMAND,
          text: "set light [NAME] rotation to r:[R] p:[P] y:[Y]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_lightRotation",
          blockType: BlockType.REPORTER,
          text: "light [NAME] rotation as [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            TYPE: { type: ArgumentType.STRING, menu: "threeLighting_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_changeLightRotation",
          blockType: BlockType.COMMAND,
          text: "change light [NAME] rotation by r:[R] p:[P] y:[Y]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_setLightColor",
          blockType: BlockType.COMMAND,
          text: "set light [NAME] color to [COLOR]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            COLOR: { type: ArgumentType.COLOR, defaultValue: "#ffffff" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_lightColor",
          blockType: BlockType.REPORTER,
          text: "light [NAME] color",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_setLightIntensity",
          blockType: BlockType.COMMAND,
          text: "set light [NAME] intensity to [INTENSITY]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            INTENSITY: { type: ArgumentType.NUMBER, defaultValue: 1 }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_lightIntensity",
          blockType: BlockType.REPORTER,
          text: "light [NAME] intensity",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_attachLightToSprite",
          blockType: BlockType.COMMAND,
          text: "attach light [NAME] to [SPRITE] with type [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            SPRITE: { type: ArgumentType.STRING, menu: "threeLighting_spriteMenu", defaultValue: "" },
            TYPE: { type: ArgumentType.STRING, menu: "threeLighting_bindTypeMenu", defaultValue: "both" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_lightAttachedTo",
          blockType: BlockType.REPORTER,
          text: "sprite light [NAME] is attached to",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_detachLight",
          blockType: BlockType.COMMAND,
          text: "detach light [NAME]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_setLightPositionalOffset",
          blockType: BlockType.COMMAND,
          text: "set light positional offset of [NAME] to x:[X] y:[Y] z:[Z]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_lightPositionalOffset",
          blockType: BlockType.REPORTER,
          text: "light [NAME] positional offset as [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            TYPE: { type: ArgumentType.STRING, menu: "threeLighting_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_setLightRotationalOffset",
          blockType: BlockType.COMMAND,
          text: "set light rotational offset of [NAME] to r:[R] p:[P] y:[Y]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        },
        {
          opcode: "threeLighting_lightRotationalOffset",
          blockType: BlockType.REPORTER,
          text: "light [NAME] rotational offset as [TYPE]",
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "light1" },
            TYPE: { type: ArgumentType.STRING, menu: "threeLighting_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Lighting[0],
          color2: extcolors.Lighting[1],
          color3: extcolors.Lighting[2],
          hideFromPalette: !this.showCategory.lighting
        }
      ];

      const soundBlocks = [
        {
          opcode: 'threeSound_playSound3D',
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
          color1: extcolors.Sound[0],
          color2: extcolors.Sound[1],
          color3: extcolors.Sound[2],
          hideFromPalette: !this.showCategory.sound
        },
        {
          opcode: 'threeSound_isSoundPlaying3D',
          blockType: BlockType.BOOLEAN,
          text: 'is 3D sound playing?',
          color1: extcolors.Sound[0],
          color2: extcolors.Sound[1],
          color3: extcolors.Sound[2],
          hideFromPalette: !this.showCategory.sound
        }
      ];

      const eventsBlocks = [
        {
          opcode: 'threeEvents_WhenSpriteClicked3D',
          blockType: BlockType.HAT,
          text: 'When sprite clicked in 3D',
          color1: extcolors.Events[0],
          color2: extcolors.Events[1],
          color3: extcolors.Events[2],
          hideFromPalette: !this.showCategory.events
        },
        {
          opcode: 'threeEvents_isSpriteClicked3D',
          blockType: BlockType.BOOLEAN,
          text: 'is sprite clicked in 3D?',
          color1: extcolors.Events[0],
          color2: extcolors.Events[1],
          color3: extcolors.Events[2],
          hideFromPalette: !this.showCategory.events
        }
      ];

      const controlBlocks = [
        {
          opcode: 'threeControl_helloWorld',
          blockType: BlockType.REPORTER,
          text: 'hello world',
          color1: extcolors.Control[0],
          color2: extcolors.Control[1],
          color3: extcolors.Control[2],
          hideFromPalette: !this.showCategory.control
        }
      ];

      const sensingBlocks = [
        {
          opcode: 'threeSensing_createHitbox',
          blockType: BlockType.COMMAND,
          text: 'give [SPRITE] a [SHAPE] shaped hitbox named [HITBOX]',
          arguments: {
            SHAPE: { type: ArgumentType.STRING, menu: "threeSensing_shapes", defaultValue: "none" },
            HITBOX: { type: ArgumentType.STRING, defaultValue: "my hitbox" },
            SPRITE: { type: ArgumentType.STRING, menu: "threeSensing_spriteMenu", defaultValue: "" },
          },
          color1: extcolors.Sensing[0],
          color2: extcolors.Sensing[1],
          color3: extcolors.Sensing[2],
          hideFromPalette: !this.showCategory.sensing
        },
        {
          opcode: 'threeSensing_hitboxExists',
          blockType: BlockType.BOOLEAN,
          text: 'hitbox [HITBOX] exists on [SPRITE]?',
          arguments: {
            HITBOX: { type: ArgumentType.STRING, defaultValue: "my hitbox" },
            SPRITE: { type: ArgumentType.STRING, menu: "threeSensing_spriteMenu", defaultValue: "" },
          },
          color1: extcolors.Sensing[0],
          color2: extcolors.Sensing[1],
          color3: extcolors.Sensing[2],
          hideFromPalette: !this.showCategory.sensing
        },
        {
          opcode: 'threeSensing_deleteHitbox',
          blockType: BlockType.COMMAND,
          text: 'delete hitbox [HITBOX] of [SPRITE]',
          arguments: {
            HITBOX: { type: ArgumentType.STRING, defaultValue: "my hitbox" },
            SPRITE: { type: ArgumentType.STRING, menu: "threeSensing_spriteMenu", defaultValue: "" },
          },
          color1: extcolors.Sensing[0],
          color2: extcolors.Sensing[1],
          color3: extcolors.Sensing[2],
          hideFromPalette: !this.showCategory.sensing
        },
        {
          opcode: 'threeSensing_createShape',
          blockType: BlockType.COMMAND,
          text: 'add hitbox shape [NAME] with data [DATA]',
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "my shape" },
            DATA: { type: ArgumentType.STRING, defaultValue: "0 0 0" },
          },
          color1: extcolors.Sensing[0],
          color2: extcolors.Sensing[1],
          color3: extcolors.Sensing[2],
          hideFromPalette: !this.showCategory.sensing
        },
        {
          opcode: 'threeSensing_shapeExists',
          blockType: BlockType.BOOLEAN,
          text: 'shape [NAME] exists?',
          arguments: {
            NAME: { type: ArgumentType.STRING, defaultValue: "my shape" },
          },
          color1: extcolors.Sensing[0],
          color2: extcolors.Sensing[1],
          color3: extcolors.Sensing[2],
          hideFromPalette: !this.showCategory.sensing
        },
        {
          opcode: 'threeSensing_removeShape',
          blockType: BlockType.COMMAND,
          text: 'remove hitbox shape [NAME]',
          arguments: {
            NAME: { type: ArgumentType.STRING, menu: "threeSensing_shapes", defaultValue: "none" },
          },
          color1: extcolors.Sensing[0],
          color2: extcolors.Sensing[1],
          color3: extcolors.Sensing[2],
          hideFromPalette: !this.showCategory.sensing
        },
        {
          opcode: 'threeSensing_collisionMesh',
          blockType: BlockType.BOOLEAN,
          text: 'is sprite [Sprite1] touching sprite [Sprite2] by mesh?',
          arguments: {
            Sprite1: { type: ArgumentType.STRING, menu: "threeSensing_spriteMenu", defaultValue: "" },
            Sprite2: { type: ArgumentType.STRING, menu: "threeSensing_spriteMenu", defaultValue: "" },
          },
          color1: extcolors.Sensing[0],
          color2: extcolors.Sensing[1],
          color3: extcolors.Sensing[2],
          hideFromPalette: !this.showCategory.sensing
        },
        {
          opcode: 'threeSensing_collisionHitbox',
          blockType: BlockType.BOOLEAN,
          text: 'is hitbox [HITBOX1] touching hitbox [HITBOX2]?',
          arguments: {
            HITBOX1: { type: ArgumentType.STRING, defaultValue: "hitbox1" },
            HITBOX2: { type: ArgumentType.STRING, defaultValue: "hitbox2" }
          },
          color1: extcolors.Sensing[0],
          color2: extcolors.Sensing[1],
          color3: extcolors.Sensing[2],
          hideFromPalette: !this.showCategory.sensing
        },
        {
          opcode: 'threeSensing_hitboxesof',
          blockType: BlockType.REPORTER,
          text: 'hitboxes of [SPRITE]',
          arguments: {
            SPRITE: { type: ArgumentType.STRING, menu: "threeSensing_spriteMenu", defaultValue: "" },
          },
          color1: extcolors.Sensing[0],
          color2: extcolors.Sensing[1],
          color3: extcolors.Sensing[2],
          hideFromPalette: !this.showCategory.sensing
        }
      ];

      const cameraBlocks = [
        {
          opcode: "threeCamera_existingCameras",
          blockType: BlockType.REPORTER,
          text: "existing cameras",
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_camerasData",
          blockType: BlockType.REPORTER,
          text: "cameras data",
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_activeCamera",
          blockType: BlockType.REPORTER,
          text: "active camera",
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_createCamera",
          blockType: BlockType.COMMAND,
          text: "create [TYPE] camera [CAMERA]",
          arguments: {
            TYPE: { type: ArgumentType.STRING, menu: "threeCamera_cameraTypeMenu", defaultValue: "perspective" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera2" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraExists",
          blockType: BlockType.BOOLEAN,
          text: "camera [CAMERA] exists?",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera2" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_deleteCamera",
          blockType: BlockType.COMMAND,
          text: "delete camera [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera2" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_focusCamera",
          blockType: BlockType.COMMAND,
          text: "focus on camera [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_moveCameraSteps",
          blockType: BlockType.COMMAND,
          text: "move camera [CAMERA] [STEPS] steps in 3D",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            STEPS: { type: ArgumentType.NUMBER, defaultValue: 10 },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_setCameraPosition",
          blockType: BlockType.COMMAND,
          text: "set camera position of [CAMERA] to x:[X] y:[Y] z:[Z]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraXPosition",
          blockType: BlockType.REPORTER,
          text: "camera x position of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraYPosition",
          blockType: BlockType.REPORTER,
          text: "camera y position of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraZPosition",
          blockType: BlockType.REPORTER,
          text: "camera z position of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraPosition",
          blockType: BlockType.REPORTER,
          text: "camera position of [CAMERA] as [TYPE]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            TYPE: { type: ArgumentType.STRING, menu: "threeCamera_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_changeCameraPosition",
          blockType: BlockType.COMMAND,
          text: "change camera position of [CAMERA] by x:[X] y:[Y] z:[Z]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_setCameraRotation",
          blockType: BlockType.COMMAND,
          text: "set camera rotation of [CAMERA] to r:[R] p:[P] y:[Y]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraRoll",
          blockType: BlockType.REPORTER,
          text: "camera roll of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraPitch",
          blockType: BlockType.REPORTER,
          text: "camera pitch of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraYaw",
          blockType: BlockType.REPORTER,
          text: "camera yaw of [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraRotation",
          blockType: BlockType.REPORTER,
          text: "camera rotation of [CAMERA] as [TYPE]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            TYPE: { type: ArgumentType.STRING, menu: "threeCamera_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_changeCameraRotation",
          blockType: BlockType.COMMAND,
          text: "change camera rotation of [CAMERA] by r:[R] p:[P] y:[Y]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_setCameraPosMenu",
          blockType: BlockType.COMMAND,
          text: "set camera pos [POSTYPES] of [CAMERA] to [NUMBER]",
          arguments: {
            POSTYPES: { type: ArgumentType.STRING, menu: "threeCamera_postypes", defaultValue: "x" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_setCameraRotMenu",
          blockType: BlockType.COMMAND,
          text: "set camera rot [ROTTYPES] of [CAMERA] to [NUMBER]",
          arguments: {
            ROTTYPES: { type: ArgumentType.STRING, menu: "threeCamera_rottypes", defaultValue: "roll" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraDirectionAround",
          blockType: BlockType.REPORTER,
          text: "camera direction around [ROTTYPES] of [CAMERA]",
          arguments: {
            ROTTYPES: { type: ArgumentType.STRING, menu: "threeCamera_rottypes", defaultValue: "roll" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_setCameraPositionalOffset",
          blockType: BlockType.COMMAND,
          text: "set camera positional offset of [CAMERA] to x:[X] y:[Y] z:[Z]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraPositionalOffset",
          blockType: BlockType.REPORTER,
          text: "camera [CAMERA] positional offset as [TYPE]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            TYPE: { type: ArgumentType.STRING, menu: "threeCamera_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_setCameraRotationalOffset",
          blockType: BlockType.COMMAND,
          text: "set camera rotational offset of [CAMERA] to r:[R] p:[P] y:[Y]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            R: { type: ArgumentType.NUMBER, defaultValue: 0 },
            P: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_cameraRotationalOffset",
          blockType: BlockType.REPORTER,
          text: "camera [CAMERA] rotational offset as [TYPE]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            TYPE: { type: ArgumentType.STRING, menu: "threeCamera_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_bindCamera",
          blockType: BlockType.COMMAND,
          text: "attach camera [CAMERA] to [SPRITE] with type [TYPE]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            SPRITE: { type: ArgumentType.STRING, menu: "threeCamera_spriteMenu", defaultValue: "" },
            TYPE: { type: ArgumentType.STRING, menu: "threeCamera_bindTypeMenu", defaultValue: "both" }
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_bindedSprite",
          blockType: BlockType.REPORTER,
          text: "sprite camera [CAMERA] is attached to",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_unbindCamera",
          blockType: BlockType.COMMAND,
          text: "detach camera [CAMERA]",
          arguments: {
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_setCameraVis",
          blockType: BlockType.COMMAND,
          text: "set camera [CAMVIS] of [CAMERA] to [NUMBER]",
          arguments: {
            CAMVIS: { type: ArgumentType.STRING, menu: "threeCamera_camvis", defaultValue: "vertical FOV" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
            NUMBER: { type: ArgumentType.NUMBER, defaultValue: 90 },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        },
        {
          opcode: "threeCamera_getCameraVis",
          blockType: BlockType.REPORTER,
          text: "camera [CAMVIS] of [CAMERA]",
          arguments: {
            CAMVIS: { type: ArgumentType.STRING, menu: "threeCamera_camvis", defaultValue: "vertical FOV" },
            CAMERA: { type: ArgumentType.STRING, defaultValue: "camera" },
          },
          color1: extcolors.Camera[0],
          color2: extcolors.Camera[1],
          color3: extcolors.Camera[2],
          hideFromPalette: !this.showCategory.camera
        }
      ];

      const operatorsBlocks = [
        {
          opcode: "threeOperators_vector2",
          blockType: BlockType.REPORTER,
          text: "vector2 x:[X] y:[Y]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vector3",
          blockType: BlockType.REPORTER,
          text: "vector3 x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vector4",
          blockType: BlockType.REPORTER,
          text: "vector4 w:[W] x:[X] y:[Y] z:[Z]",
          arguments: {
            W: { type: ArgumentType.NUMBER, defaultValue: 0 },
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorComponent",
          blockType: BlockType.REPORTER,
          text: "[COMPONENT] of vector [VECTOR]",
          arguments: {
            COMPONENT: { type: ArgumentType.STRING, menu: "threeOperators_vectorComponents", defaultValue: "x" },
            VECTOR: { type: ArgumentType.STRING, defaultValue: "" }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorAdd",
          blockType: BlockType.REPORTER,
          text: "vector x1:[X1] y1:[Y1] z1:[Z1] + vector x2:[X2] y2:[Y2] z2:[Z2] as [TYPE]",
          arguments: {
            X1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            X2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            TYPE: { type: ArgumentType.STRING, menu: "threeOperators_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorSubtract",
          blockType: BlockType.REPORTER,
          text: "vector x1:[X1] y1:[Y1] z1:[Z1] - vector x2:[X2] y2:[Y2] z2:[Z2] as [TYPE]",
          arguments: {
            X1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            X2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            TYPE: { type: ArgumentType.STRING, menu: "threeOperators_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorMultiply",
          blockType: BlockType.REPORTER,
          text: "vector x:[X] y:[Y] z:[Z] * scalar [SCALAR] as [TYPE]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
            SCALAR: { type: ArgumentType.NUMBER, defaultValue: 1 },
            TYPE: { type: ArgumentType.STRING, menu: "threeOperators_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorDivide",
          blockType: BlockType.REPORTER,
          text: "vector x:[X] y:[Y] z:[Z] / scalar [SCALAR] as [TYPE]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
            SCALAR: { type: ArgumentType.NUMBER, defaultValue: 1 },
            TYPE: { type: ArgumentType.STRING, menu: "threeOperators_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorDistance",
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
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorLength",
          blockType: BlockType.REPORTER,
          text: "length of vector x:[X] y:[Y] z:[Z]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorNormalize",
          blockType: BlockType.REPORTER,
          text: "normalized vector x:[X] y:[Y] z:[Z] as [TYPE]",
          arguments: {
            X: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z: { type: ArgumentType.NUMBER, defaultValue: 0 },
            TYPE: { type: ArgumentType.STRING, menu: "threeOperators_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorDot",
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
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorCross",
          blockType: BlockType.REPORTER,
          text: "cross product of x1:[X1] y1:[Y1] z1:[Z1] and x2:[X2] y2:[Y2] z2:[Z2] as [TYPE]",
          arguments: {
            X1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z1: { type: ArgumentType.NUMBER, defaultValue: 0 },
            X2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Y2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            Z2: { type: ArgumentType.NUMBER, defaultValue: 0 },
            TYPE: { type: ArgumentType.STRING, menu: "threeOperators_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        },
        {
          opcode: "threeOperators_vectorLerp",
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
            TYPE: { type: ArgumentType.STRING, menu: "threeOperators_dataTypeMenu", defaultValue: "array" }
          },
          color1: extcolors.Operators[0],
          color2: extcolors.Operators[1],
          color3: extcolors.Operators[2],
          hideFromPalette: !this.showCategory.operators
        }
      ];

      const penBlocks = [
        {
          opcode: 'threePen_penDown',
          blockType: BlockType.COMMAND,
          text: '3D pen down',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_isPenDown',
          blockType: BlockType.BOOLEAN,
          text: 'is 3D pen down?',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_penUp',
          blockType: BlockType.COMMAND,
          text: '3D pen up',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_setPenColor',
          blockType: BlockType.COMMAND,
          text: 'set 3D pen color to [COLOR]',
          arguments: {
            COLOR: { type: ArgumentType.COLOR, defaultValue: '#000000' }
          },
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_getPenColor',
          blockType: BlockType.REPORTER,
          text: '3D pen color',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_changePenColor',
          blockType: BlockType.COMMAND,
          text: 'change 3D pen color by [VALUE]',
          arguments: {
            VALUE: { type: ArgumentType.NUMBER, defaultValue: 10 }
          },
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_setPenSize',
          blockType: BlockType.COMMAND,
          text: 'set 3D pen size to [SIZE]',
          arguments: {
            SIZE: { type: ArgumentType.NUMBER, defaultValue: 1 }
          },
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_getPenSize',
          blockType: BlockType.REPORTER,
          text: '3D pen size',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_changePenSize',
          blockType: BlockType.COMMAND,
          text: 'change 3D pen size by [SIZE]',
          arguments: {
            SIZE: { type: ArgumentType.NUMBER, defaultValue: 1 }
          },
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_setPenMaterial',
          blockType: BlockType.COMMAND,
          text: 'set material of 3D pen to [MATERIAL]',
          arguments: {
            MATERIAL: { type: ArgumentType.STRING, defaultValue: "basic" }
          },
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_getPenMaterial',
          blockType: BlockType.REPORTER,
          text: '3D pen material',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_setPenBrush',
          blockType: BlockType.COMMAND,
          text: 'set 3D pen brush to [BRUSH]',
          arguments: {
            BRUSH: { type: ArgumentType.STRING, menu: "threePen_brushMenu", defaultValue: "brush" }
          },
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_getPenBrush',
          blockType: BlockType.REPORTER,
          text: '3D pen brush',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_stamp',
          blockType: BlockType.COMMAND,
          text: '3D stamp',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_clear',
          blockType: BlockType.COMMAND,
          text: 'clear 3D drawings',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_drawShape',
          blockType: BlockType.COMMAND,
          text: 'draw [SHAPE] with width: [WIDTH] height: [HEIGHT] depth [DEPTH] at x: [X] y: [Y] z: [Z] with roll [ROLL] pitch: [PITCH] yaw: [YAW]',
          arguments: {
            SHAPE: { type: ArgumentType.STRING, menu: "threePen_shapeMenu", defaultValue: "box" },
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
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_stamp2DImage',
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
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_setPenShade',
          blockType: BlockType.COMMAND,
          text: 'set 3D pen shade to [SHADE]',
          arguments: {
            SHADE: { type: ArgumentType.NUMBER, defaultValue: 50 }
          },
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_getPenShade',
          blockType: BlockType.REPORTER,
          text: '3D pen shade',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_changePenShade',
          blockType: BlockType.COMMAND,
          text: 'change 3D pen shade by [SHADE]',
          arguments: {
            SHADE: { type: ArgumentType.NUMBER, defaultValue: 10 }
          },
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_setPenTransparency',
          blockType: BlockType.COMMAND,
          text: 'set 3D pen transparency to [ALPHA]',
          arguments: {
            ALPHA: { type: ArgumentType.NUMBER, defaultValue: 100 }
          },
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        },
        {
          opcode: 'threePen_getPenTransparency',
          blockType: BlockType.REPORTER,
          text: '3D pen transparency',
          color1: extcolors.Pen[0],
          color2: extcolors.Pen[1],
          color3: extcolors.Pen[2],
          hideFromPalette: !this.showCategory.pen
        }
      ];

      const blocks = [];
      
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Base",
      });
      blocks.push(...baseBlocks);

      blocks.push({
        opcode: "threeMotion_toggleCategory",
        blockType: BlockType.BUTTON,
        text: this.showCategory.motion ? "Hide Motion" : "Show Motion",
        color1: extcolors.Motion[0],
        color2: extcolors.Motion[1],
        color3: extcolors.Motion[2],
        func: "threeMotion_toggleCategory"
      });
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Motion",
        hideFromPalette: !this.showCategory.motion
      });
      blocks.push(...motionBlocks);

      blocks.push({
        opcode: "threeLooks_toggleCategory",
        blockType: BlockType.BUTTON,
        text: this.showCategory.looks ? "Hide Looks" : "Show Looks",
        color1: extcolors.Looks[0],
        color2: extcolors.Looks[1],
        color3: extcolors.Looks[2],
        func: "threeLooks_toggleCategory"
      });
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Looks",
        hideFromPalette: !this.showCategory.looks
      });
      blocks.push(...looksBlocks);

      blocks.push({
        opcode: "threeLighting_toggleCategory",
        blockType: BlockType.BUTTON,
        text: this.showCategory.lighting ? "Hide Lighting" : "Show Lighting",
        color1: extcolors.Lighting[0],
        color2: extcolors.Lighting[1],
        color3: extcolors.Lighting[2],
        func: "threeLighting_toggleCategory"
      });
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Lighting",
        hideFromPalette: !this.showCategory.lighting
      });
      blocks.push(...lightingBlocks);

      blocks.push({
        opcode: "threeSound_toggleCategory",
        blockType: BlockType.BUTTON,
        text: this.showCategory.sound ? "Hide Sound" : "Show Sound",
        color1: extcolors.Sound[0],
        color2: extcolors.Sound[1],
        color3: extcolors.Sound[2],
        func: "threeSound_toggleCategory"
      });
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Sound",
        hideFromPalette: !this.showCategory.sound
      });
      blocks.push(...soundBlocks);

      blocks.push({
        opcode: "threeEvents_toggleCategory",
        blockType: BlockType.BUTTON,
        text: this.showCategory.events ? "Hide Events" : "Show Events",
        color1: extcolors.Events[0],
        color2: extcolors.Events[1],
        color3: extcolors.Events[2],
        func: "threeEvents_toggleCategory"
      });
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Events",
        hideFromPalette: !this.showCategory.events
      });
      blocks.push(...eventsBlocks);

      blocks.push({
        opcode: "threeControl_toggleCategory",
        blockType: BlockType.BUTTON,
        text: this.showCategory.control ? "Hide Control" : "Show Control",
        color1: extcolors.Control[0],
        color2: extcolors.Control[1],
        color3: extcolors.Control[2],
        func: "threeControl_toggleCategory"
      });
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Control",
        hideFromPalette: !this.showCategory.control
      });
      blocks.push(...controlBlocks);

      blocks.push({
        opcode: "threeSensing_toggleCategory",
        blockType: BlockType.BUTTON,
        text: this.showCategory.sensing ? "Hide Sensing" : "Show Sensing",
        color1: extcolors.Sensing[0],
        color2: extcolors.Sensing[1],
        color3: extcolors.Sensing[2],
        func: "threeSensing_toggleCategory"
      });
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Sensing",
        hideFromPalette: !this.showCategory.sensing
      });
      blocks.push(...sensingBlocks);

      blocks.push({
        opcode: "threeCamera_toggleCategory",
        blockType: BlockType.BUTTON,
        text: this.showCategory.camera ? "Hide Camera" : "Show Camera",
        color1: extcolors.Camera[0],
        color2: extcolors.Camera[1],
        color3: extcolors.Camera[2],
        func: "threeCamera_toggleCategory"
      });
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Camera",
        hideFromPalette: !this.showCategory.camera
      });
      blocks.push(...cameraBlocks);

      blocks.push({
        opcode: "threeOperators_toggleCategory",
        blockType: BlockType.BUTTON,
        text: this.showCategory.operators ? "Hide Operators" : "Show Operators",
        color1: extcolors.Operators[0],
        color2: extcolors.Operators[1],
        color3: extcolors.Operators[2],
        func: "threeOperators_toggleCategory"
      });
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Operators",
        hideFromPalette: !this.showCategory.operators
      });
      blocks.push(...operatorsBlocks);

      blocks.push({
        opcode: "threePen_toggleCategory",
        blockType: BlockType.BUTTON,
        text: this.showCategory.pen ? "Hide Pen" : "Show Pen",
        color1: extcolors.Pen[0],
        color2: extcolors.Pen[1],
        color3: extcolors.Pen[2],
        func: "threePen_toggleCategory"
      });
      blocks.push({
        blockType: BlockType.LABEL,
        text: "Pen",
        hideFromPalette: !this.showCategory.pen
      });
      blocks.push(...penBlocks);

      return blocks;
    }

    toggleCategory(category) {
      if (this.showCategory.hasOwnProperty(category)) {
        this.showCategory[category] = !this.showCategory[category];
        this.reloadBlocks();
      }
    }

    threeBase_toggleCategory() {
      this.toggleCategory('base');
    }

    threeMotion_toggleCategory() {
      this.toggleCategory('motion');
    }

    threeLooks_toggleCategory() {
      this.toggleCategory('looks');
    }

    threeLighting_toggleCategory() {
      this.toggleCategory('lighting');
    }

    threeSound_toggleCategory() {
      this.toggleCategory('sound');
    }

    threeEvents_toggleCategory() {
      this.toggleCategory('events');
    }

    threeControl_toggleCategory() {
      this.toggleCategory('control');
    }

    threeSensing_toggleCategory() {
      this.toggleCategory('sensing');
    }

    threeCamera_toggleCategory() {
      this.toggleCategory('camera');
    }

    threeOperators_toggleCategory() {
      this.toggleCategory('operators');
    }

    threePen_toggleCategory() {
      this.toggleCategory('pen');
    }

    threeBase_isOn() {
      return is3DInitialized && !is3DHidden;
    }

    threeBase_setEnabled(args) {
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

    threeBase_getEnabled() {
      if (!is3DInitialized) return "off";
      if (is3DHidden) return "hide";
      return "on";
    }

    threeBase_getView() {
      if (!is3DInitialized || is3DHidden) return "";
      

      threeRenderer.render(scene, activeCamera);
      
      return threeRenderer.domElement.toDataURL('image/png');
    }

    threeBase_setSkyboxColor(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const color = new THREE.Color(Cast.toString(args.COLOR));
      scene.background = color;
      updateRenderer();
    }

    threeBase_getSkyboxColor() {
      if (!is3DInitialized || is3DHidden || !scene.background) return "#000000";
      
      if (scene.background.isColor) {
        return '#' + scene.background.getHexString();
      }
      return "#000000";
    }

    threeMotion_moveSteps(args, util) {
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

    threeMotion_setPosition(args, util) {
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

    threeMotion_xPosition(args, util) {
      if (util.target.isStage) return '0';
      return util.target.x.toString();
    }

    threeMotion_yPosition(args, util) {
      if (util.target.isStage) return '0';
      return util.target.y.toString();
    }

    threeMotion_zPosition(args, util) {
      if (util.target.isStage) return '0';
      if (!is3DInitialized || is3DHidden) return '0';
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (dr[IN_3D] && dr[OBJECT]) {
        return dr[OBJECT].position.z.toString();
      }
      return '0';
    }

    threeMotion_changePosition(args, util) {
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

    threeMotion_setRotation(args, util) {
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

    threeMotion_roll(args, util) {
      if (util.target.isStage) return '0';
      if (!is3DInitialized || is3DHidden) return '0';
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (!dr[IN_3D]) return '0';
      return (dr[ROLL] * 180 / Math.PI).toString();
    }

    threeMotion_pitch(args, util) {
      if (util.target.isStage) return '0';
      if (!is3DInitialized || is3DHidden) return '0';
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (!dr[IN_3D]) return '0';
      return (dr[PITCH] * 180 / Math.PI).toString();
    }

    threeMotion_yaw(args, util) {
      if (util.target.isStage) return '0';
      if (!is3DInitialized || is3DHidden) return '0';
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (!dr[IN_3D]) return '0';
      return (dr[YAW] * 180 / Math.PI).toString();
    }

    threeMotion_changeRotation(args, util) {
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

    threeMotion_setPosMenu(args, util) {
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

    threeMotion_setRotMenu(args, util) {
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

    threeMotion_directionAround(args, util) {
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

    threeMotion_position(args, util) {
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

    threeMotion_rotation(args, util) {
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

    threeMotion_turnDegrees(args, util) {
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

    threeMotion_direction(args, util) {
      if (util.target.isStage) return '0';
      return util.target.direction.toString();
    }

    threeLooks_existingModels() {
      if (!is3DInitialized || is3DHidden) return JSON.stringify([]);
      return JSON.stringify(Object.keys(loadedModels));
    }

    threeLooks_existingMaterials() {
      if (!is3DInitialized || is3DHidden) return JSON.stringify([]);
      
      const materials = new Set();
      
      Object.keys(loadedMaterials).forEach(key => materials.add(key));
      
      if (THREE.Materials) {
        Object.keys(THREE.Materials).forEach(key => materials.add(key));
      }
      
      return JSON.stringify(Array.from(materials));
    }

    threeLooks_existingTextures() {
      if (!is3DInitialized || is3DHidden) return JSON.stringify([]);
      return JSON.stringify(Object.keys(loadedTextures));
    }

    threeLooks_spriteMode(args, util) {
      if (util.target.isStage) return "disabled";
      if (!is3DInitialized || is3DHidden) return "disabled";
      
      const dr = renderer._allDrawables[util.target.drawableID];
      return dr._3dMode || "disabled";
    }

    threeLooks_flatLayers(args, util) {
      if (util.target.isStage) return '1';
      if (!is3DInitialized || is3DHidden) return '1';
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (!dr[IN_3D]) return '1';
      return (dr._flatLayers || 1).toString();
    }

    threeLooks_setMode(args, util) {
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

    threeLooks_setFlatLayers(args, util) {
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

    threeLooks_setModel(args, util) {
      if (!is3DInitialized || is3DHidden || util.target.isStage) return;
      
      const modelName = Cast.toString(args.MODEL);
      if (!modelName || !loadedModels[modelName]) return;
      
      util.target.lastModel = modelName;
      
      enable3DForDrawable(util.target.drawableID, "model");
      this._applyModelToTarget(util.target, modelName);
    }

    threeLooks_currentModel(args, util) {
      if (util.target.isStage) return "";
      if (!is3DInitialized || is3DHidden) return "";
      return util.target.lastModel || "";
    }

    async threeLooks_createModelFromString(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const name = Cast.toString(args.NAME);
      const data = Cast.toString(args.STRINGDATA);
      const type = Cast.toString(args.TYPE);
      
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
        
        if (type === "GLTF" || type === "GLB") {
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

    async threeLooks_createModelFromList(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const name = Cast.toString(args.NAME);
      const listName = Cast.toString(args.LIST);
      const type = Cast.toString(args.TYPE);
      
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
      await this.threeLooks_createModelFromString({ NAME: name, STRINGDATA: data, TYPE: type });
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

    threeLooks_deletemodel(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const name = Cast.toString(args.MODEL);
      if (loadedModels[name]) {
        loadedModels[name].traverse(child => {
          if (child.dispose) child.dispose();
        });
        delete loadedModels[name];
      }
    }

    threeLooks_setTextureFilter(args, util) {
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

    threeLooks_getTextureFilter(args, util) {
      if (util.target.isStage) return "nearest";
      if (!is3DInitialized || is3DHidden) return "nearest";
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (!dr[IN_3D]) return "nearest";
      
      return dr[TEX_FILTER] === THREE.NearestFilter ? "nearest" : "linear";
    }

    threeLooks_showFaces(args, util) {
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

    threeLooks_getShowFaces(args, util) {
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

    threeLooks_set3DStretch(args, util) {
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

    threeLooks_stretchX(args, util) {
      if (util.target.isStage) return '100';
      if (!is3DInitialized || is3DHidden) return '100';
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (!dr[IN_3D] || !dr[OBJECT]) return '100';
      return (dr[OBJECT].scale.x * 100).toString();
    }

    threeLooks_stretchY(args, util) {
      if (util.target.isStage) return '100';
      if (!is3DInitialized || is3DHidden) return '100';
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (!dr[IN_3D] || !dr[OBJECT]) return '100';
      return (dr[OBJECT].scale.y * 100).toString();
    }

    threeLooks_stretchZ(args, util) {
      if (util.target.isStage) return '100';
      if (!is3DInitialized || is3DHidden) return '100';
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (!dr[IN_3D] || !dr[OBJECT]) return '100';
      return (dr[OBJECT].scale.z * 100).toString();
    }

    threeLooks_change3DStretch(args, util) {
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

    threeLooks_set3DStretchMenu(args, util) {
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

    threeLooks_change3DStretchMenu(args, util) {
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

    threeLooks_stretches(args, util) {
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

    threeLooks_setModelMaterial(args, util) {
      if (!is3DInitialized || is3DHidden || util.target.isStage) return;
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (!dr[IN_3D] || dr._3dMode !== "model") return;
      
      const materialName = Cast.toString(args.MATERIAL);
      if (materialName === "basic") {
        this.threeLooks_resetMaterial(args, util);
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

    threeLooks_currentMaterial(args, util) {
      if (util.target.isStage) return "";
      if (!is3DInitialized || is3DHidden) return "";
      
      const dr = renderer._allDrawables[util.target.drawableID];
      if (!dr[IN_3D] || dr._3dMode !== "model") return "";
      return dr[MATERIAL_NAME] || "";
    }

    threeLooks_resetMaterial(args, util) {
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

    async threeLooks_addMaterial(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const name = Cast.toString(args.NAME);
      const textureName = Cast.toString(args.TEXTURE);
      
      if (loadedMaterials[name]) {
        console.warn(`Material "${name}" already exists`);
        return;
      }
      
      if (!loadedTextures[textureName]) {
        console.warn(`Texture "${textureName}" not found`);
        return;
      }
      
      const material = new THREE.MeshStandardMaterial({
        map: loadedTextures[textureName],
        side: THREE.DoubleSide
      });
      
      loadedMaterials[name] = material;
    }

    threeLooks_removeMaterial(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const materialName = Cast.toString(args.MATERIAL);
      if (loadedMaterials[materialName]) {
        loadedMaterials[materialName].dispose();
        delete loadedMaterials[materialName];
      }
    }

    threeLooks_addTexture(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const name = Cast.toString(args.NAME);
      const data = Cast.toString(args.DATA);
      
      if (loadedTextures[name]) {
        console.warn(`Texture "${name}" already exists`);
        return;
      }
      
      try {
        const textureLoader = new THREE.TextureLoader();
        const texture = textureLoader.load(data, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          loadedTextures[name] = tex;
        });
        
        loadedTextures[name] = texture;
      } catch (error) {
        console.error(`Failed to load texture "${name}":`, error);
      }
    }

    threeLooks_deleteTexture(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const name = Cast.toString(args.NAME);
      if (loadedTextures[name]) {
        loadedTextures[name].dispose();
        delete loadedTextures[name];
      }
    }

    threeLooks_getTexture(args) {
      if (!is3DInitialized || is3DHidden) return "";
      
      const name = Cast.toString(args.NAME);
      if (loadedTextures[name]) {
        return name;
      }
      return "";
    }

    threeLooks_materialExists(args) {
      if (!is3DInitialized || is3DHidden) return false;
      
      const name = Cast.toString(args.NAME);
      return !!loadedMaterials[name];
    }

    threeLooks_getMaterial(args) {
      if (!is3DInitialized || is3DHidden) return "";
      
      const name = Cast.toString(args.NAME);
      if (loadedMaterials[name]) {
        return name;
      }
      return "";
    }

    threeLooks_setMaterialProperty(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const materialName = Cast.toString(args.MATERIAL);
      const property = Cast.toString(args.PROPERTY);
      const value = Cast.toString(args.VALUE);
      
      const material = loadedMaterials[materialName];
      if (!material) return;
      
      switch (property) {
        case "color":
          material.color.set(value);
          break;
        case "emissive":
          material.emissive.set(value);
          break;
        case "roughness":
          material.roughness = Cast.toNumber(value);
          break;
        case "metalness":
          material.metalness = Cast.toNumber(value);
          break;
        case "transparency":
          material.opacity = Cast.toNumber(value) / 100;
          material.transparent = material.opacity < 1;
          break;
        case "shininess":
          if (material.shininess !== undefined) {
            material.shininess = Cast.toNumber(value);
          }
          break;
      }
      
      material.needsUpdate = true;
      updateRenderer();
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

    threeLighting_setLightDependency(args) {
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
        const currentMaterial = dr[MATERIAL_NAME];
        if (currentMaterial) {
          this._applyMaterialToDrawable(target.drawableID, currentMaterial);
        } else {
          this.threeLooks_resetMaterial({}, { target: target });
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

    threeLighting_getLightDependency(args) {
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

    threeLighting_existingLights() {
      if (!is3DInitialized || is3DHidden) return JSON.stringify([]);
      
      const lightNames = Object.keys(lights);
      return JSON.stringify(lightNames);
    }

    threeLighting_lightsData() {
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

    threeLighting_createLight(args) {
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

    threeLighting_lightExists(args) {
      if (!is3DInitialized || is3DHidden) return false;
      
      const name = Cast.toString(args.NAME);
      return !!lights[name];
    }

    threeLighting_deleteLight(args) {
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

    threeLighting_setLightPosition(args) {
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

    threeLighting_lightPosition(args) {
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

    threeLighting_changeLightPosition(args) {
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

    threeLighting_setLightRotation(args) {
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

    threeLighting_lightRotation(args) {
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

    threeLighting_changeLightRotation(args) {
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

    threeLighting_setLightColor(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const name = Cast.toString(args.NAME);
      const color = Cast.toString(args.COLOR);
      
      if (lights[name] && lights[name].light) {
        lights[name].light.color.set(color);
        updateRenderer();
      }
    }

    threeLighting_lightColor(args) {
      if (!is3DInitialized || is3DHidden) return '';
      
      const name = Cast.toString(args.NAME);
      
      if (!lights[name] || !lights[name].light) {
        return '';
      }
      
      return '#' + lights[name].light.color.getHexString();
    }

    threeLighting_setLightIntensity(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const name = Cast.toString(args.NAME);
      const intensity = Cast.toNumber(args.INTENSITY);
      
      if (lights[name] && lights[name].light) {
        lights[name].light.intensity = intensity;
        updateRenderer();
      }
    }

    threeLighting_lightIntensity(args) {
      if (!is3DInitialized || is3DHidden) return '0';
      
      const name = Cast.toString(args.NAME);
      
      if (!lights[name] || !lights[name].light) {
        return '0';
      }
      
      return lights[name].light.intensity.toString();
    }

    threeLighting_attachLightToSprite(args) {
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

    threeLighting_lightAttachedTo(args) {
      if (!is3DInitialized || is3DHidden) return '';
      
      const name = Cast.toString(args.NAME);
      
      if (!lights[name]) {
        return '';
      }
      
      return lights[name].attachedTo || '';
    }

    threeLighting_detachLight(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const name = Cast.toString(args.NAME);
      
      if (lights[name]) {
        lights[name].attachedTo = null;
        lights[name].attachmentType = null;
        updateRenderer();
      }
    }

    threeLighting_setLightPositionalOffset(args) {
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

    threeLighting_lightPositionalOffset(args) {
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

    threeLighting_setLightRotationalOffset(args) {
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

    threeLighting_lightRotationalOffset(args) {
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

    threeSound_playSound3D() {
      if (!is3DInitialized || is3DHidden) return;
      return '';
    }

    threeSound_isSoundPlaying3D() {
      return false;
    }

    threeEvents_WhenSpriteClicked3D() {
      return false;
    }

    threeEvents_isSpriteClicked3D() {
      if (!is3DInitialized || is3DHidden) return false;
      return false;
    }

    threeControl_helloWorld() {
      return 'bork bork!';
    }

    threeSensing_createHitbox() {
      if (!is3DInitialized || is3DHidden) return;
      return '';
    }

    threeSensing_hitboxExists() {
      if (!is3DInitialized || is3DHidden) return false;
      return false;
    }

    threeSensing_deleteHitbox() {
      if (!is3DInitialized || is3DHidden) return;
      return '';
    }

    threeSensing_createShape() {
      if (!is3DInitialized || is3DHidden) return;
      return '';
    }

    threeSensing_shapeExists() {
      if (!is3DInitialized || is3DHidden) return false;
      return false;
    }

    threeSensing_removeShape() {
      if (!is3DInitialized || is3DHidden) return;
      return '';
    }

    threeSensing_collisionMesh() {
      if (!is3DInitialized || is3DHidden) return false;
      return false;
    }

    threeSensing_collisionHitbox(args) {
      if (!is3DInitialized || is3DHidden) return false;
      
      const hitbox1 = Cast.toString(args.HITBOX1);
      const hitbox2 = Cast.toString(args.HITBOX2);
      
      return hitbox1 === hitbox2;
    }

    threeSensing_hitboxesof() {
      if (!is3DInitialized || is3DHidden) return JSON.stringify([]);
      return JSON.stringify([]);
    }

    threeCamera_existingCameras() {
      if (!is3DInitialized || is3DHidden) return JSON.stringify(["camera"]);
      return JSON.stringify(Object.keys(cameras));
    }

    threeCamera_camerasData() {
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

    threeCamera_activeCamera() {
      if (!is3DInitialized || is3DHidden) return "";
      return activeCamera.name || "";
    }

    threeCamera_createCamera(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const cameraType = Cast.toString(args.TYPE);
      const cameraName = Cast.toString(args.CAMERA);
      
      if (cameras[cameraName]) {
        console.warn(`Camera "${cameraName}" already exists`);
        return;
      }
      
      createCamera(cameraName, cameraType);
    }

    threeCamera_cameraExists(args) {
      if (!is3DInitialized || is3DHidden) return false;
      const cameraName = Cast.toString(args.CAMERA);
      return !!(cameras[cameraName]);
    }

    threeCamera_deleteCamera(args) {
      if (!is3DInitialized || is3DHidden) return;
      const cameraName = Cast.toString(args.CAMERA);
      deleteCamera(cameraName);
    }

    threeCamera_focusCamera(args) {
      if (!is3DInitialized || is3DHidden) return;
      
      const cameraName = Cast.toString(args.CAMERA);
      if (!cameras[cameraName]) {
        console.warn(`Camera "${cameraName}" does not exist`);
        return;
      }
      
      activeCamera = cameras[cameraName];
      updateRenderer();
    }

    threeCamera_moveCameraSteps(args) {
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

    threeCamera_setCameraPosition(args) {
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

    threeCamera_cameraXPosition(args) {
      if (!is3DInitialized || is3DHidden) return '0';
      
      const cameraName = Cast.toString(args.CAMERA);
      const camera = cameras[cameraName];
      if (!camera) return '0';
      
      return camera.position.x.toString();
    }

    threeCamera_cameraYPosition(args) {
      if (!is3DInitialized || is3DHidden) return '0';
      
      const cameraName = Cast.toString(args.CAMERA);
      const camera = cameras[cameraName];
      if (!camera) return '0';
      
      return camera.position.y.toString();
    }

    threeCamera_cameraZPosition(args) {
      if (!is3DInitialized || is3DHidden) return '0';
      
      const cameraName = Cast.toString(args.CAMERA);
      const camera = cameras[cameraName];
      if (!camera) return '0';
      
      return camera.position.z.toString();
    }

    threeCamera_cameraPosition(args) {
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

    threeCamera_changeCameraPosition(args) {
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

    threeCamera_setCameraRotation(args) {
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

    threeCamera_cameraRoll(args) {
      if (!is3DInitialized || is3DHidden) return '0';
      
      const cameraName = Cast.toString(args.CAMERA);
      const camera = cameras[cameraName];
      if (!camera) return '0';
      
      return (camera.rotation.z * 180 / Math.PI).toString();
    }

    threeCamera_cameraPitch(args) {
      if (!is3DInitialized || is3DHidden) return '0';
      
      const cameraName = Cast.toString(args.CAMERA);
      const camera = cameras[cameraName];
      if (!camera) return '0';
      
      return (camera.rotation.x * 180 / Math.PI).toString();
    }

    threeCamera_cameraYaw(args) {
      if (!is3DInitialized || is3DHidden) return '0';
      
      const cameraName = Cast.toString(args.CAMERA);
      const camera = cameras[cameraName];
      if (!camera) return '0';
      
      return (camera.rotation.y * 180 / Math.PI).toString();
    }

    threeCamera_cameraRotation(args) {
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

    threeCamera_changeCameraRotation(args) {
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

    threeCamera_setCameraPosMenu(args) {
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

    threeCamera_setCameraRotMenu(args) {
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

    threeCamera_cameraDirectionAround(args) {
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

    threeCamera_setCameraPositionalOffset(args) {
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

    threeCamera_cameraPositionalOffset(args) {
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

    threeCamera_setCameraRotationalOffset(args) {
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

    threeCamera_cameraRotationalOffset(args) {
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

    threeCamera_bindCamera(args) {
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

    threeCamera_bindedSprite(args) {
      if (!is3DInitialized || is3DHidden) return JSON.stringify('');
      
      const cameraName = Cast.toString(args.CAMERA);
      const camera = cameras[cameraName];
      if (!camera) return JSON.stringify('');
      
      return JSON.stringify(camera.userData.attachedTo || '');
    }

    threeCamera_unbindCamera(args) {
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

    threeCamera_setCameraVis(args) {
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

    threeCamera_getCameraVis(args) {
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

    threeOperators_vector2(args) {
      const x = Cast.toNumber(args.X);
      const y = Cast.toNumber(args.Y);
      return JSON.stringify([x, y]);
    }

    threeOperators_vector3(args) {
      const x = Cast.toNumber(args.X);
      const y = Cast.toNumber(args.Y);
      const z = Cast.toNumber(args.Z);
      return JSON.stringify([x, y, z]);
    }

    threeOperators_vector4(args) {
      const w = Cast.toNumber(args.W);
      const x = Cast.toNumber(args.X);
      const y = Cast.toNumber(args.Y);
      const z = Cast.toNumber(args.Z);
      return JSON.stringify([w, x, y, z]);
    }

    threeOperators_vectorComponent(args) {
      const component = Cast.toString(args.COMPONENT);
      const vectorStr = Cast.toString(args.VECTOR);
      
      try {
        const vector = JSON.parse(vectorStr);
        if (Array.isArray(vector)) {
          if (component === "w" && vector.length >= 1) return vector[0].toString();
          if (component === "x" && vector.length >= 2) return vector[1].toString();
          if (component === "y" && vector.length >= 3) return vector[2].toString();
          if (component === "z" && vector.length >= 4) return vector[3].toString();
        }
      } catch (e) {
        const parts = vectorStr.split(',').map(p => p.trim());
        if (component === "w" && parts.length >= 1) return parts[0];
        if (component === "x" && parts.length >= 2) return parts[1];
        if (component === "y" && parts.length >= 3) return parts[2];
        if (component === "z" && parts.length >= 4) return parts[3];
      }
      
      return "0";
    }

    threeOperators_vectorAdd(args) {
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

    threeOperators_vectorSubtract(args) {
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

    threeOperators_vectorMultiply(args) {
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

    threeOperators_vectorDivide(args) {
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

    threeOperators_vectorDistance(args) {
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

    threeOperators_vectorLength(args) {
      const x = Cast.toNumber(args.X);
      const y = Cast.toNumber(args.Y);
      const z = Cast.toNumber(args.Z);
      
      const length = Math.sqrt(x * x + y * y + z * z);
      return length.toString();
    }

    threeOperators_vectorNormalize(args) {
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

    threeOperators_vectorDot(args) {
      const x1 = Cast.toNumber(args.X1);
      const y1 = Cast.toNumber(args.Y1);
      const z1 = Cast.toNumber(args.Z1);
      const x2 = Cast.toNumber(args.X2);
      const y2 = Cast.toNumber(args.Y2);
      const z2 = Cast.toNumber(args.Z2);
      
      const dot = (x1 * x2) + (y1 * y2) + (z1 * z2);
      return dot.toString();
    }

    threeOperators_vectorCross(args) {
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

    threeOperators_vectorLerp(args) {
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

    threePen_penDown() {
      if (!is3DInitialized || is3DHidden) return;
      pen3DState.isDown = true;
      return '';
    }

    threePen_isPenDown() {
      return pen3DState.isDown;
    }

    threePen_penUp() {
      pen3DState.isDown = false;
      return '';
    }

    threePen_setPenColor(args) {
      pen3DState.color = Cast.toString(args.COLOR);
      return '';
    }

    threePen_getPenColor() {
      return pen3DState.color;
    }

    threePen_changePenColor() {
      return '';
    }

    threePen_setPenSize(args) {
      pen3DState.size = Cast.toNumber(args.SIZE);
      return '';
    }

    threePen_getPenSize() {
      return pen3DState.size.toString();
    }

    threePen_changePenSize(args) {
      pen3DState.size += Cast.toNumber(args.SIZE);
      return '';
    }

    threePen_setPenMaterial(args) {
      pen3DState.material = Cast.toString(args.MATERIAL);
      return '';
    }

    threePen_getPenMaterial() {
      return pen3DState.material;
    }

    threePen_setPenBrush(args) {
      pen3DState.brush = Cast.toString(args.BRUSH);
      return '';
    }

    threePen_getPenBrush() {
      return pen3DState.brush;
    }

    threePen_stamp() {
      if (!is3DInitialized || is3DHidden) return;
      return '';
    }

    threePen_clear() {
      if (!is3DInitialized || is3DHidden) return;
      if (penGroup) {
        while (penGroup.children.length > 0) {
          const child = penGroup.children[0];
          penGroup.remove(child);
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        }
        updateRenderer();
      }
      return '';
    }

    threePen_drawShape(args) {
      if (!is3DInitialized || is3DHidden || !pen3DState.isDown) return;
      
      if (!penGroup) {
        penGroup = new THREE.Group();
        scene.add(penGroup);
      }
      
      const shape = Cast.toString(args.SHAPE);
      const width = Cast.toNumber(args.WIDTH);
      const height = Cast.toNumber(args.HEIGHT);
      const depth = Cast.toNumber(args.DEPTH);
      const x = Cast.toNumber(args.X);
      const y = Cast.toNumber(args.Y);
      const z = Cast.toNumber(args.Z);
      const roll = Cast.toNumber(args.ROLL) * Math.PI / 180;
      const pitch = Cast.toNumber(args.PITCH) * Math.PI / 180;
      const yaw = Cast.toNumber(args.YAW) * Math.PI / 180;
      
      let geometry;
      switch (shape) {
        case "box":
          geometry = new THREE.BoxGeometry(width, height, depth);
          break;
        case "sphere":
          geometry = new THREE.SphereGeometry(width / 2, 32, 16);
          break;
        case "cylinder":
          geometry = new THREE.CylinderGeometry(width / 2, width / 2, height, 32);
          break;
        case "cone":
          geometry = new THREE.ConeGeometry(width / 2, height, 32);
          break;
        case "plane":
          geometry = new THREE.PlaneGeometry(width, height);
          break;
        case "torus":
          geometry = new THREE.TorusGeometry(width / 2, depth / 4, 16, 100);
          break;
        default:
          geometry = new THREE.BoxGeometry(width, height, depth);
      }
      
      const material = new THREE.MeshStandardMaterial({
        color: new THREE.Color(pen3DState.color),
        roughness: 0.5,
        metalness: 0.0,
        side: THREE.DoubleSide,
        transparent: pen3DState.transparency < 100,
        opacity: pen3DState.transparency / 100
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.rotation.set(pitch, yaw, roll);
      
      penGroup.add(mesh);
      updateRenderer();
      return '';
    }

    threePen_stamp2DImage() {
      if (!is3DInitialized || is3DHidden) return;
      return '';
    }

    threePen_setPenShade(args) {
      pen3DState.shade = Cast.toNumber(args.SHADE);
      return '';
    }

    threePen_getPenShade() {
      return pen3DState.shade.toString();
    }

    threePen_changePenShade(args) {
      pen3DState.shade += Cast.toNumber(args.SHADE);
      return '';
    }

    threePen_setPenTransparency(args) {
      pen3DState.transparency = Cast.toNumber(args.ALPHA);
      return '';
    }

    threePen_getPenTransparency() {
      return pen3DState.transparency.toString();
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

    getLists() {
      const lists = getAllLists();
      const menuItems = lists.map(list => ({ text: list, value: list }));
      return menuItems.length > 0 ? menuItems : [{ text: "", value: "" }];
    }

    getShapes() {
      if (!is3DInitialized || is3DHidden) return [{ text: "none", value: "none" }];
      return [{ text: "none", value: "none" }];
    }
  }

  Scratch.extensions.register(new DragoThree());
})(Scratch);
