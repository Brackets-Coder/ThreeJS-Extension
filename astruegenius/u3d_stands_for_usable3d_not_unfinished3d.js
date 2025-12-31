(async function (Scratch) {
	'use strict';

	if (!Scratch.extensions.unsandboxed) {
		throw new Error('Usable 3D must be run unsandboxed!');
	}

	//Initialization

	const DRAWABLE_GROUP_NAME = "u3d";
	const DRAW_BEFORE = "video";
	const DRAWABLE_DISPLAY_NAME = "u3d layer";

	const renderer = Scratch.vm.renderer;
	const runtime = Scratch.vm.runtime;

	let screenNativeSize = Scratch.renderer.getNativeSize();

	//Loading 2 libraries here. Rapier and ThreeJS. Reminder : Release the extension with dataURI of the extensions!!!
	const THREE = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.min.js");
	const { GLTFLoader } = await import("https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js/+esm");
	const RAPIER = await import('https://cdn.jsdelivr.net/npm/@dimforge/rapier3d-compat@0.19.2/+esm');

	await RAPIER.init();

	const threerenderer = new THREE.WebGLRenderer({ antialias: true });
	threerenderer.setClearAlpha(0);
	threerenderer.setSize(screenNativeSize[0], screenNativeSize[1]);

	const Skin = renderer.exports.Skin;

	class NewCanvasSkin extends Skin {
		constructor(id, renderer) {
			super(id, renderer);
			const gl = renderer.gl;
			const texture = gl.createTexture();
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			this._texture = texture;
			this._rotationCenter = [(screenNativeSize[0] / 2), (screenNativeSize[1] / 2)];
		}
		dispose() {
			if (this._texture) {
				this._renderer.gl.deleteTexture(this._texture);
				this._texture = null;
			}
			super.dispose();
		}
		get size() {
			return [screenNativeSize[0], screenNativeSize[1]];
		}
		getTexture(scale) {
			return this._texture || super.getTexture();
		}
		setContent(textureData) {
			const gl = this._renderer.gl;
			gl.bindTexture(gl.TEXTURE_2D, this._texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textureData);
			this.emitWasAltered();
		}
	}

	let index = renderer._groupOrdering.indexOf(DRAW_BEFORE);
	renderer._groupOrdering.splice(index + 1, 0, DRAWABLE_GROUP_NAME);

	renderer._layerGroups[DRAWABLE_GROUP_NAME] = { groupIndex: 0, drawListOffset: renderer._layerGroups[DRAW_BEFORE].drawListOffset, };

	for (let i = 0; i < renderer._groupOrdering.length; i++) { renderer._layerGroups[renderer._groupOrdering[i]].groupIndex = i; }

	let skinId = renderer._nextSkinId++;
	let skin = new NewCanvasSkin(skinId, renderer);
	renderer._allSkins[skinId] = skin;

	let drawableId = renderer.createDrawable(DRAWABLE_GROUP_NAME);

	renderer._allDrawables[drawableId].customDrawableName = DRAWABLE_DISPLAY_NAME;

	renderer.updateDrawableSkinId(drawableId, skinId);

	const scene = new THREE.Scene();
	const camera = new THREE.PerspectiveCamera(75, screenNativeSize[0] / screenNativeSize[1], 0.1, 1000);
	camera.position.set(0, 0, 5);

	let world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

	function changeObjectPosition(object, x, y, z) {
		object.position.x += x; object.position.y += y; object.position.z += z;
	}

	//The world/physics

	let objects = new Map();
	let materials = new Map();
	let textures = new Map();
	let lights = new Map();

	await RAPIER.init();

	const textureLoader = new THREE.TextureLoader();
	const gltfLoader = new GLTFLoader();

	function toRadians(degrees) { return degrees * (Math.PI / 180) }
	function toDegrees(radians) { return radians * (180 / Math.PI) }

	function updatePhysics(objects, world) {
		world.step();

		for (const obj of objects.values()) {
			if (obj.userData) {
				const phys = obj.userData.physics;
				if (!phys || !phys.rigidBody) continue;

				const rb = phys.rigidBody;
				const t = rb.translation();
				const r = rb.rotation();

				obj.position.set(t.x, t.y, t.z);

				if (!(phys.isCharacter && phys.type === "dynamic")) {
					obj.quaternion.set(r.x, r.y, r.z, r.w);
				}
			}
		}
	}

	function updateMixers(dt) {
		scene.traverse(o => {
			if (o.mixer) o.mixer.update(dt);
		});
	}

	const drawOriginal = renderer.draw;
	let re = false;
	renderer.draw = function () {
		if (this.dirty || re) redraw();
		drawOriginal.call(this);
	}

	const clock = new THREE.Clock();

	function redraw() {
		re = true;
		updatePhysics(objects, world);
		const dt = clock.getDelta();
		updateMixers(dt);
		threerenderer.render(scene, camera);
		skin.setContent(threerenderer.domElement);
		runtime.requestRedraw();
		re = false;
	}

	//redraw();

	class u3d {
		getInfo() {
			return {
				id: 'u3d',
				name: 'Usable 3D',
				blocks: [
					{
						opcode: 'init',
						blockType: Scratch.BlockType.COMMAND,
						text: 'initialize'
					},
					{ blockType: Scratch.BlockType.LABEL, text: "transforms & changes" },
					{
						opcode: 'camera',
						blockType: Scratch.BlockType.COMMAND,
						text: 'modify [modifier] [modify] of camera (value: [x])',
						arguments: {
							modifier: { type: Scratch.ArgumentType.STRING, menu: 'modifier' },
							modify: { type: Scratch.ArgumentType.STRING, menu: 'modify' },
							x: { type: Scratch.ArgumentType.NUMBER },
						}
					},
					{
						opcode: "getcamera",
						blockType: Scratch.BlockType.REPORTER,
						text: "camera: [info]",
						arguments: {
							info: {
								type: Scratch.ArgumentType.STRING,
								menu: 'cameradd'
							}
						}
					},
					{
						opcode: 'cameraOther',
						blockType: Scratch.BlockType.COMMAND,
						text: 'modify [modifier] [modifyOther] of camera (x: [x], y: [y], z: [z])',
						arguments: {
							modifier: { type: Scratch.ArgumentType.STRING, menu: 'modifier' },
							modifyOther: { type: Scratch.ArgumentType.STRING, menu: 'modifyOther' },
							x: { type: Scratch.ArgumentType.NUMBER },
							y: { type: Scratch.ArgumentType.NUMBER },
							z: { type: Scratch.ArgumentType.NUMBER },
						}
					},
					{
						opcode: 'object',
						blockType: Scratch.BlockType.COMMAND,
						text: 'modify [modifier] [modify] of object (value: [x]) (name: [name])',
						arguments: {
							modifier: { type: Scratch.ArgumentType.STRING, menu: 'modifier' },
							modify: { type: Scratch.ArgumentType.STRING, menu: 'modifyObjects' },
							x: { type: Scratch.ArgumentType.NUMBER },
							name: { type: Scratch.ArgumentType.STRING },
						}
					},
					{
						opcode: 'objectOther',
						blockType: Scratch.BlockType.COMMAND,
						text: 'modify [modifier] [modify] of object (name: [name]) (x: [x], y: [y], z: [z])',
						arguments: {
							modifier: { type: Scratch.ArgumentType.STRING, menu: 'modifier' },
							modify: { type: Scratch.ArgumentType.STRING, menu: 'modifyOther' },
							x: { type: Scratch.ArgumentType.NUMBER },
							y: { type: Scratch.ArgumentType.NUMBER },
							z: { type: Scratch.ArgumentType.NUMBER },
							name: { type: Scratch.ArgumentType.STRING },
						}
					},
					{ blockType: Scratch.BlockType.LABEL, text: "objects" },
					{
						opcode: "getobject",
						blockType: Scratch.BlockType.REPORTER,
						text: "get [info] of object: [name]",
						arguments: {
							info: { type: Scratch.ArgumentType.STRING, menu: 'objectdd' },
							name: { type: Scratch.ArgumentType.STRING, }
						}
					},
					{
						opcode: "deleteobj",
						blockType: Scratch.BlockType.COMMAND,
						text: "delete object: [name]",
						arguments: {
							name: { type: Scratch.ArgumentType.STRING, }
						}
					},
					{
						opcode: "objectexists",
						blockType: Scratch.BlockType.BOOLEAN,
						text: "does object: [name] exist?",
						arguments: {
							name: { type: Scratch.ArgumentType.STRING, }
						}
					},
					{
						opcode: 'createObject',
						blockType: Scratch.BlockType.COMMAND,
						text: 'create [objectType] name: [name] position: [position] scale: [scaling] rotation: [rotation]',
						arguments: {
							objectType: { type: Scratch.ArgumentType.STRING, menu: 'objectType' },
							name: { type: Scratch.ArgumentType.STRING },
							position: { type: Scratch.ArgumentType.STRING },
							scaling: { type: Scratch.ArgumentType.STRING },
							rotation: { type: Scratch.ArgumentType.STRING },
						}
					},
					{
						opcode: 'loadGLTF',
						blockType: Scratch.BlockType.COMMAND,
						text: 'load GLB model: [data]',
						arguments: {
							data: { type: Scratch.ArgumentType.STRING }
						}
					},
					{
						opcode: 'makePhysicsBody',
						blockType: Scratch.BlockType.COMMAND,
						text: 'make physics body for: [object] type: [type]',
						arguments: {
							object: { type: Scratch.ArgumentType.STRING },
							type: { type: Scratch.ArgumentType.STRING, menu: 'physicsType' }
						}
					},
					{
						opcode: 'modifyPhysics',
						blockType: Scratch.BlockType.COMMAND,
						text: '[action] physics object: [object] x: [x] y: [y] z: [z]',
						arguments: {
							action: {
								type: Scratch.ArgumentType.STRING,
								menu: 'physicsActions'
							},
							object: { type: Scratch.ArgumentType.STRING },
							x: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
							y: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 },
							z: { type: Scratch.ArgumentType.NUMBER, defaultValue: 0 }
						}
					},
					{
						opcode: 'objectPropertiesGet',
						blockType: Scratch.BlockType.REPORTER,
						text: '[value] of object: [object]',
						arguments: {
							value: { type: Scratch.ArgumentType.STRING, menu: 'objectProperties' },
							object: { type: Scratch.ArgumentType.STRING },
						}
					},
					{
						opcode: 'objectPropertiesSet',
						blockType: Scratch.BlockType.COMMAND,
						text: 'set property: [value] of object: [object] value: [number]',
						arguments: {
							value: { type: Scratch.ArgumentType.STRING, menu: 'objectProperties' },
							object: { type: Scratch.ArgumentType.STRING },
							number: { type: Scratch.ArgumentType.STRING },
						}
					},
					{
						opcode: 'startAnimation',
						blockType: Scratch.BlockType.COMMAND,
						text: 'start animation: [animation] object: [object]',
						arguments: {
							object: { type: Scratch.ArgumentType.STRING },
							animation: { type: Scratch.ArgumentType.STRING },
						}
					},
					{ blockType: Scratch.BlockType.LABEL, text: "materials & textures" },
					{
						opcode: 'material',
						blockType: Scratch.BlockType.COMMAND,
						text: 'create material: [material]',
						arguments: {
							material: { type: Scratch.ArgumentType.STRING },
						}
					},
					{
						opcode: 'setMaterial',
						blockType: Scratch.BlockType.COMMAND,
						text: 'set: [materialValue] in material: [material] to: [value]',
						arguments: {
							materialValue: { type: Scratch.ArgumentType.STRING, menu: 'materialProperties' },
							material: { type: Scratch.ArgumentType.STRING },
							value: { type: Scratch.ArgumentType.STRING },
						}
					},
					{
						opcode: 'texture',
						blockType: Scratch.BlockType.COMMAND,
						text: 'create texture: [texture] from costume: [costume]',
						arguments: {
							texture: { type: Scratch.ArgumentType.STRING },
							costume: { type: Scratch.ArgumentType.COSTUME },
						}
					},
					{ blockType: Scratch.BlockType.LABEL, text: "lights" },
					{
						opcode: 'createLight',
						blockType: Scratch.BlockType.COMMAND,
						text: 'create light: [light] type: [lightType]',
						arguments: {
							light: { type: Scratch.ArgumentType.STRING },
							lightType: { type: Scratch.ArgumentType.STRING, menu: "lightTypes" },
						}
					},
					{
						opcode: 'modifyLight',
						blockType: Scratch.BlockType.COMMAND,
						text: 'modify light: [light] [modifier] [lightPosition] (x: [x], y: [y], z: [z])',
						arguments: {
							modifier: { type: Scratch.ArgumentType.STRING, menu: "modifier" },
							light: { type: Scratch.ArgumentType.STRING },
							lightPosition: { type: Scratch.ArgumentType.STRING, menu: "lightPosition" },
							x: { type: Scratch.ArgumentType.NUMBER },
							y: { type: Scratch.ArgumentType.NUMBER },
							z: { type: Scratch.ArgumentType.NUMBER }
						}
					},
					{
						opcode: 'modifyLightOther',
						blockType: Scratch.BlockType.COMMAND,
						text: 'modify light: [light] [modifier] value: [x]',
						arguments: {
							modifier: { type: Scratch.ArgumentType.STRING, menu: "lightOtherMenu" },
							light: { type: Scratch.ArgumentType.STRING },
							x: { type: Scratch.ArgumentType.STRING }
						}
					},
					{ blockType: Scratch.BlockType.LABEL, text: "utilities" },
					{
						opcode: 'vector3',
						blockType: Scratch.BlockType.REPORTER,
						text: 'vector3 (x: [x], y: [y], z: [z])',
						arguments: {
							x: { type: Scratch.ArgumentType.NUMBER },
							y: { type: Scratch.ArgumentType.NUMBER },
							z: { type: Scratch.ArgumentType.NUMBER },
						}
					},
					{
						opcode: 'getter',
						blockType: Scratch.BlockType.REPORTER,
						text: 'get data: [propertyList] name: [name]',
						arguments: {
							propertyList: { type: Scratch.ArgumentType.STRING, menu: "maps" },
							name: { type: Scratch.ArgumentType.STRING },
						}
					},
					{ blockType: Scratch.BlockType.LABEL, text: "logic" },
					{
						opcode: 'startTick',
						blockType: Scratch.BlockType.COMMAND,
						text: 'tick',
					},
					{
						opcode: 'tick',
						blockType: Scratch.BlockType.EVENT,
						text: 'when tick',
						isEdgeActivated: false
					},
				],
				menus: {
					cameradd: {
						acceptReporters: true,
						items: ['x', 'y', 'z', 'pitch', 'yaw', 'roll', 'near', 'far', 'fov']
					},
					objectdd: {
						acceptReporters: true,
						items: ['x', 'y', 'z', 'pitch', 'yaw', 'roll', 'scale x', 'scale y', 'scale z']
					},
					modifier: {
						acceptCOMMANDs: true,
						items: ['set', 'change']
					},
					modify: {
						acceptCOMMANDs: true,
						items: ['x', 'y', 'z', 'rotation x', 'rotation y', 'rotation z', 'FOV', 'near plane', 'far plane']
					},
					modifyObjects: {
						acceptCOMMANDs: true,
						items: ['x', 'y', 'z', 'rotation x', 'rotation y', 'rotation z', 'scale x', 'scale y', 'scale z']
					},
					modifyOther: {
						acceptCOMMANDs: true,
						items: ['position', 'rotation', 'scale']
					},
					objectType: {
						acceptCOMMANDs: true,
						items: ['BoxGeometry', 'SphereGeometry', 'PlaneGeometry']
					},
					physicsType: {
						acceptCOMMANDs: true,
						items: ['dynamic', 'static', 'kinematic']
					},
					physicsActions: {
						acceptCOMMANDs: true,
						items: ['teleport', 'rotate', 'set velocity', 'apply force', 'apply impulse']
					},
					objectProperties: {
						acceptCOMMANDs: true,
						items: ['tags', 'material', 'cast shadow', 'recieve shadows']
					},
					materialProperties: {
						acceptCOMMANDs: true,
						items: ['color', 'roughness', 'metalness', 'map', 'lightMap', 'lightMapIntensity', 'aoMap', 'aoMapIntensity', 'emissive', 'emissiveIntensity', 'emissiveMap', 'bumpMap', 'bumpScale', 'normalMap', 'normalScale', 'displacementMap', 'displacementScale', 'displacementBias', 'envMap', 'envMapIntensity', 'metalnessMap', 'roughnessMap', 'alphaMap', 'transparent', 'opacity', 'flatShading', 'fog', 'wireframe', 'wireframeLinewidth']
					},
					lightTypes: {
						acceptCOMMANDs: true,
						items: ['AmbientLight', 'DirectionalLight', 'PointLight', 'SpotLight']
					},
					lightPosition: {
						acceptCOMMANDs: true,
						items: ['position', 'target']
					},
					lightOtherMenu: {
						acceptCOMMANDs: true,
						items: ['color', 'intensity', 'distance', 'decay', 'angle', 'penumbra', 'castShadow', 'shadow.bias', 'shadow.radius', 'shadow.mapSize.width', 'shadow.mapSize.height', 'map']
					},
					maps: {
						acceptCOMMANDs: true,
						items: ['texture', 'material']
					},
				}
			};
		}
		init() {
			objects.clear();
			textures.clear();
			materials.clear();
			lights.clear();
			for (let i = scene.children.length - 1; i >= 0; i--) {
				const child = scene.children[i];

				if (child.geometry) child.geometry.dispose();

				if (child.material) {
					if (Array.isArray(child.material)) { child.material.forEach(m => m.dispose()); }
					else { child.material.dispose(); }
				}

				scene.remove(child);
			}

			world.forEachRigidBody(rb => world.removeRigidBody(rb));
			world.forEachCollider(collider => world.removeCollider(collider));
		}
		camera(args) {
			const value = args.x;
			const modify = args.modify;
			switch (args.modifier) {
				case 'x': camera.position.x = (modify === 'set' ? value : camera.position.x + value); break;
				case 'y': camera.position.y = (modify === 'set' ? value : camera.position.y + value); break;
				case 'z': camera.position.z = (modify === 'set' ? value : camera.position.z + value); break;
				case 'rotation x': camera.rotation.x = (modify === 'set' ? toRadians(value) : camera.rotation.x + toRadians(value)); break;
				case 'rotation y': camera.rotation.y = (modify === 'set' ? toRadians(value) : camera.rotation.y + toRadians(value)); break;
				case 'rotation z': camera.rotation.z = (modify === 'set' ? toRadians(value) : camera.rotation.z + toRadians(value)); break;
				case 'FOV': camera.fov = (modify === 'set' ? value : camera.fov + value); camera.updateProjectionMatrix(); break;
				case 'near plane': camera.near = value; camera.updateProjectionMatrix(); break;
				case 'far plane': camera.far = value; camera.updateProjectionMatrix(); break;
			}
		}
		getcamera(args) {
			const info = args.info;
			switch (info) {
				case 'x': return camera.position.x;
				case 'y': return camera.position.y;
				case 'z': return camera.position.z;
				case 'near': return camera.near;
				case 'far': return camera.far;
				case 'fov': return camera.fov;
				case 'pitch': return toDegrees(camera.rotation.x);
				case 'yaw': return toDegrees(camera.rotation.y);
				case 'roll': return toDegrees(camera.rotation.z);
			}
		}
		cameraOther(args) {
			const x = args.x;
			const y = args.y;
			const z = args.z;
			switch (args.modifyOther) {
				case 'position': camera.position.set(x, y, z); break;
				case 'rotation': camera.rotation.set(x, y, z); break;
			}
		}
		getobject(args) {
			const object = objects.get(args.name);
			switch (args.info) {
				case 'x': return object.position.x;
				case 'y': return object.position.y;
				case 'z': return object.position.z;
				case 'pitch': return toDegrees(object.rotation.x);
				case 'yaw': return toDegrees(object.rotation.y);
				case 'roll': return toDegrees(object.rotation.z);
				case 'scale x': return object.scale.x;
				case 'scale y': return object.scale.y;
				case 'scale z': return object.scale.z;
			}
		}
		deleteobj(args) {
			const object = objects.get(args.name);
			if (object) {
				scene.remove(object);
			}
		}
		objectexists(args) {
			const object = objects.get(args.name);

			if (object) return "true"
			else return "false"
		}
		object(args) {
			const value = args.x;
			const modify = args.modifier;
			const object = objects.get(args.name);
			switch (args.modify) {
				case 'x': object.position.x = (modify === 'set' ? value : object.position.x + value); break;
				case 'y': object.position.y = (modify === 'set' ? value : object.position.y + value); break;
				case 'z': object.position.z = (modify === 'set' ? value : object.position.z + value); break;
				case 'rotation x': object.rotation.x = (modify === 'set' ? toRadians(value) : object.rotation.x + toRadians(value)); break;
				case 'rotation y': object.rotation.y = (modify === 'set' ? toRadians(value) : object.rotation.y + toRadians(value)); break;
				case 'rotation z': object.rotation.z = (modify === 'set' ? toRadians(value) : object.rotation.z + toRadians(value)); break;
				case 'scale x': object.scale.x = (modify === 'set' ? value : object.scale.x + value); break;
				case 'scale y': object.scale.y = (modify === 'set' ? value : object.scale.y + value); break;
				case 'scale z': object.scale.z = (modify === 'set' ? value : object.scale.z + value); break;
			}
		}
		objectOther(args) {
			const x = args.x, y = args.y, z = args.z, modify = args.modifier, obj = objects.get(args.name);
			switch (args.modify) {
				case 'position': modify === 'set' ? obj.position.set(x, y, z) : (obj.position.x += x, obj.position.y += y, obj.position.z += z); break;
				case 'rotation': modify === 'set' ? obj.rotation.set(toRadians(x), toRadians(y), toRadians(z)) : (obj.rotation.x += toRadians(x), obj.rotation.y += toRadians(y), obj.rotation.z += toRadians(z)); break;
				case 'scale': modify === 'set' ? obj.scale.set(x, y, z) : (obj.scale.x += x, obj.scale.y += y, obj.scale.z += z); break;
			}
		}
		createObject(args) {
			let geometry, mesh;

			const position = JSON.parse(args.position);
			const scaling = JSON.parse(args.scaling);
			const rotation = JSON.parse(args.rotation);

			switch (args.objectType) {
				case 'BoxGeometry': geometry = new THREE.BoxGeometry(1, 1, 1); break;
				case 'SphereGeometry': geometry = new THREE.SphereGeometry(); break;
				case 'PlaneGeometry': geometry = new THREE.PlaneGeometry(); break;
			}

			mesh = new THREE.Mesh(geometry, null);
			mesh.position.set(position.x, position.y, position.z);
			mesh.scale.set(scaling.x, scaling.y, scaling.z);
			mesh.rotation.set(toRadians(rotation.x), toRadians(rotation.y), toRadians(rotation.z));

			scene.add(mesh);
			objects.set(args.name, mesh);
			console.log(mesh)
		}
		async loadGLTF(args) {
			const uri = args.data;

			gltfLoader.load(uri, gltf => {
				const root = gltf.scene;
				const clips = gltf.animations;

				for (const obj of root.children) {
					scene.add(obj);
					console.log(obj.name)

					objects.set(obj.name, obj);

					if (clips.length) {
						obj.mixer = new THREE.AnimationMixer(obj);
						obj.clips = clips;
					}
				}
			});
		}
		makePhysicsBody(args) {
			const obj = objects.get(args.object);

			const pos = obj.position;
			const scale = obj.scale;

			let rbDesc;
			if (args.type === "dynamic") rbDesc = RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z)
			else if (args.type === "kinematic") rbDesc = RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(pos.x, pos.y, pos.z)
			else rbDesc = RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
			
			const rigidBody = world.createRigidBody(rbDesc);

			let colliderDesc;

			if (obj.geometry.type === "BoxGeometry") colliderDesc = RAPIER.ColliderDesc.cuboid(scale.x / 2, scale.y / 2, scale.z / 2)
			else if (obj.geometry.type === "SphereGeometry") colliderDesc = RAPIER.ColliderDesc.ball(scale.x / 2)
			else if (obj.geometry.type === "PlaneGeometry") colliderDesc = RAPIER.ColliderDesc.cuboid(scale.x / 2, 0.01, scale.y / 2)
			else {
				const vertices = obj.geometry.attributes.position.array;

				const indices = obj.geometry.index.array;

				colliderDesc = RAPIER.ColliderDesc.trimesh(vertices, indices);

			}
			//else { colliderDesc = RAPIER.ColliderDesc.trimesh( obj.geometry.attributes.position.array, obj.geometry.index ? obj.geometry.index.array : undefined) }

			world.createCollider(colliderDesc, rigidBody);

			obj.userData.physics = { rigidBody, isCharacter: !!args.character, type: args.type };
		}
		modifyPhysics(args) {
			const obj = objects.get(args.object), rb = obj.userData.physics.rigidBody, x = args.x, y = args.y, z = args.z;
			switch (args.action) {
				case 'teleport': rb.setTranslation({ x, y, z }, true); rb.setLinvel({ x: 0, y: 0, z: 0 }); rb.setAngvel({ x: 0, y: 0, z: 0 }); break;
				case 'rotate': const quat = new THREE.Quaternion(); quat.setFromEuler(new THREE.Euler(toRadians(x), toRadians(y), toRadians(z))); rb.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w }, true); break;
				case 'set velocity': rb.setLinvel({ x, y, z }, true); break;
				case 'apply force': rb.addForce({ x, y, z }, true); break;
				case 'apply impulse': rb.applyImpulse({ x, y, z }, true); break;
			}
		}
		objectPropertiesGet(args) {
			const object = objects.get(args.object);
			if (args.value === 'tags') { return object.userData.tags }
			if (args.value === 'material') { return object.material }
		}
		objectPropertiesSet(args) {
			const object = objects.get(args.object);
			if (args.value === 'tags') object.userData.tags[0] = args.number;
			if (args.value === 'material') object.material = materials.get(args.number);
			if (args.value === 'castShadow') object.castShadow = Boolean(args.number);
			if (args.value === 'receiveShadow') object.receiveShadow = Boolean(args.number);
		}
		startAnimation(args) {
			const object = objects.get(args.object);
			const animation = args.animation;

			const clips = object.clips;
			const clip = THREE.AnimationClip.findByName(clips, animation);
			let action = object.mixer.clipAction(clip);

			action.loop = THREE.LoopOnce;
			action.play();
		}

		material(args) {
			const material = new THREE.MeshStandardMaterial();
			materials.set(args.material, material)
		}
		setMaterial(args) {
			const material = materials.get(args.material), value = args.value;
			switch (args.materialValue) {
				case 'color': material.color.set(value); break;
				case 'roughness': material.roughness = parseFloat(value); break;
				case 'metalness': material.metalness = parseFloat(value); break;
				case 'map': material.map = textures.get(value); break;
				case 'lightMap': material.lightMap = textures.get(value); break;
				case 'lightMapIntensity': material.lightMapIntensity = parseFloat(value); break;
				case 'aoMap': material.aoMap = textures.get(value); break;
				case 'aoMapIntensity': material.aoMapIntensity = parseFloat(value); break;
				case 'emissive': material.emissive.set(value); break;
				case 'emissiveIntensity': material.emissiveIntensity = parseFloat(value); break;
				case 'emissiveMap': material.emissiveMap = textures.get(value); break;
				case 'bumpMap': material.bumpMap = textures.get(value); break;
				case 'bumpScale': material.bumpScale = parseFloat(value); break;
				case 'normalMap': material.normalMap = textures.get(value); break;
				case 'normalScale': material.normalScale.set(parseFloat(value.x), parseFloat(value.y)); break;
				case 'displacementMap': material.displacementMap = textures.get(value); break;
				case 'displacementScale': material.displacementScale = parseFloat(value); break;
				case 'displacementBias': material.displacementBias = parseFloat(value); break;
				case 'envMap': material.envMap = textures.get(value); break;
				case 'envMapIntensity': material.envMapIntensity = parseFloat(value); break;
				case 'metalnessMap': material.metalnessMap = textures.get(value); break;
				case 'roughnessMap': material.roughnessMap = textures.get(value); break;
				case 'alphaMap': material.alphaMap = textures.get(value); break;
				case 'transparent': material.transparent = Boolean(value); break;
				case 'opacity': material.opacity = parseFloat(value); break;
				case 'flatShading': material.flatShading = Boolean(value); break;
				case 'fog': material.fog = Boolean(value); break;
				case 'wireframe': material.wireframe = Boolean(value); break;
				case 'wireframeLinewidth': material.wireframeLinewidth = parseFloat(value); break;
			}
			material.needsUpdate = true;
		}
		texture(args, util) {
			const target = util.target;
			const temp = args.costume;
			const costumeName = temp.toString();
			const costumeIndex = target.getCostumeIndexByName(costumeName);
			const costume = target.sprite.costumes[costumeIndex];
			const dataURI = costume.asset.encodeDataURI();
			const texture = textureLoader.load(dataURI)
			textures.set(args.texture, texture)
			console.log(dataURI)
		}
		createLight(args) {
			let light, targetObject;
			switch (args.lightType) {
				case 'AmbientLight': light = new THREE.AmbientLight(); light.name = args.light; break;
				case 'SpotLight': light = new THREE.SpotLight(); targetObject = new THREE.Object3D(); light.target = targetObject; light.name = args.light; break;
				case 'DirectionalLight': light = new THREE.DirectionalLight(); targetObject = new THREE.Object3D(); light.target = targetObject; light.name = args.light; break;
				case 'PointLight': light = new THREE.PointLight(); light.name = args.light; console.log(light); break;
			}
			scene.add(light);
			lights.set(args.light, light);
		}
		modifyLight(args) {
			let light = lights.get(args.light);
			const modify = args.lightPosition;

			switch (args.lightPosition) {
				case 'position': args.modifier === 'set' ? light.position.set(args.x, args.y, args.z) : changeObjectPosition(light, args.x, args.y, args.z); break;
				case 'target': if (light.target) args.modifier === 'set' ? light.target.position.set(args.x, args.y, args.z) : changeObjectPosition(light.target, args.x, args.y, args.z); break;
			}
		}
		modifyLightOther(args) {
			let light = lights.get(args.light);
			const value = args.x;
			switch (args.modifier) {
				case 'color': light.color?.set(x); break;
				case 'intensity': light.intensity = parseFloat(value); break;
				case 'distance': light.distance = parseFloat(value); break;
				case 'decay': light.decay = parseFloat(value); break;
				case 'angle': light.angle = parseFloat(value); break;
				case 'penumbra': light.penumbra = parseFloat(value); break;
				case 'castShadow': light.castShadow = Boolean(value); break;
				case 'shadow.bias': light.shadow.bias = parseFloat(value); break;
				case 'shadow.radius': light.shadow.radius = parseFloat(value); break;
				case 'shadow.mapSize.width': light.shadow.mapSize.width = parseFloat(value); break;
				case 'shadow.mapSize.height': light.shadow.mapSize.height = parseFloat(value); break;
			}
		}
		vector3(args) {
			return JSON.stringify(new THREE.Vector3(args.x, args.y, args.z));
		}
		getter(args) {
			switch (args.propertyList) {
				case 'texture': const texture = textures.get(args.name); return JSON.stringify(texture); break;
				case 'material': return JSON.stringify(materials.get(args.name)); break;
				case 'object': return JSON.stringify(objects.get(args.name)); break;
			}
		}
		startTick() {
			runtime.startHats(`u3d_tick`);

			redraw();
		}
		tick() {

		}
	}
	Scratch.extensions.register(new u3d());
})(Scratch);
