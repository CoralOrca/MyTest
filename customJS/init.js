
var camera, scene, renderer, controls, tWidth, tHeight, totalGroup, modelGroup, oldColor, selMesh;
const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(), meshArr = [], camDis = 10;
const colors = generateVariations();

$(document).ready(function () {
	setTotalSize();
	init();
	loadModel();
	animate();
	const inputColor = document.getElementById('inputColor');
	inputColor.addEventListener('change', e=>applyColor(e), false);
	inputColor.addEventListener('input', e=>applyColor(e), false);
});

function init() {
	const container = document.getElementById('container');
	renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setSize(tWidth, tHeight);
	container.appendChild(renderer.domElement);
	renderer.setClearColor(0x181818, 1);
	scene = new THREE.Scene();

	camera = new THREE.PerspectiveCamera(60, tWidth / tHeight, 0.01, camDis*10);
	camera.position.set(0, 0, camDis);

	controls = new THREE.OrbitControls(camera, renderer.domElement);
	controls.minDistance = camDis / 2;
	controls.maxDistance = camDis * 2;

	const ambient = new THREE.AmbientLight(0xFFFFFF, 0.3); scene.add(ambient);
	const mainLight = new THREE.DirectionalLight( 0xFFFFFF, 1 ); mainLight.position.set( -1, 1, 1 ); scene.add( mainLight );

	totalGroup = new THREE.Group(); scene.add(totalGroup);

	window.addEventListener('resize', onWindowResize,false);
	container.addEventListener('pointerup',  onMouseClick,  false);
}

function loadModel() {
	const loader = new THREE.GLTFLoader();
	loader.load( '../models/FullBody.glb', function ( gltf ) {
		const object = gltf.scene;
		const vPos = new THREE.Box3().setFromObject(object), {min, max} = vPos;
		const vSize = {
			x:max.x - min.x,
			y:max.y - min.y,
			z:max.z - min.z
		}, deltaPos = {};
		['x', 'y', 'z'].forEach(axis => {
			deltaPos[axis] = max[axis] - vSize[axis]/2;
		});
		object.children.forEach(child => {
			['x', 'y', 'z'].forEach(axis => {
				child.position[axis] -= deltaPos[axis];
			});
		});
		const scl = (camDis/1.5)/vSize.y;
		object.scale.set(scl, scl, scl);
		object.traverse( child => {
			if (child instanceof THREE.Mesh) {
				const {map, color} = child.material, hexCol = color.getHex();
				if (child.name.startsWith("ROW2_")) {
					if (child.name === "ROW2_front_B" || child.name ==="ROW2_front_D" ) {
						child.material = new THREE.MeshStandardMaterial({ color: 0x000000,  roughness: 0.2, metalness: 0.9 });
					} else {
						child.material = new THREE.MeshStandardMaterial({ color: 0xFFFFFF,  roughness: 0.7, metalness: 0.5 });
					}
				} else {
					const randomCol = colors[Math.floor(Math.random() * colors.length)]
					child.material = new THREE.MeshStandardMaterial({color:randomCol, map});
				}
				meshArr.push(child);
			}
		});
		totalGroup.add( object );
	}, undefined, undefined );
}

function onMouseClick(e) {
	var posX, posY;
	if (e.clientX && e.clientY) {
		posX = e.clientX; posY = e.clientY;
	} else if (e.touches || e.changedTouches) {
		const touch = e.touches[0] || e.changedTouches[0];
		posX = touch.pageX; posY = touch.pageY;
	}
	mouse.x = ( posX / tWidth ) * 2 - 1;
	mouse.y = -(posY / tHeight ) * 2 + 1;
	raycaster.setFromCamera( mouse, camera );
	const interInfo = raycaster.intersectObjects( meshArr )[0];
	const colorWrapper = document.getElementById('colorPickerWrapper');
	if (interInfo) {
		const inputColor = document.getElementById('inputColor');
		oldColor = interInfo.object.material.color.getHex();
		colorWrapper.classList.add('active');
		inputColor.value = '#' + oldColor.toString(16);
		inputColor.click();
		selMesh = interInfo.object
	} else {
		colorWrapper.classList.remove('active');
	}
}

function applyColor(e) {
	const hexStr = e.target.value.substring(1), decVal = parseInt(hexStr, 16);
	selMesh.material.color.setHex(decVal);
}

function onWindowResize() {
	setTotalSize();
	camera.aspect =  tWidth/ tHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(tWidth, tHeight);
}

function setTotalSize() {
	tWidth = document.getElementById("container").offsetWidth;
	tHeight = document.getElementById("container").offsetHeight;
}

function generateVariations() { // baseColor, numVariations, variationFactor
	const rgbArr = [
		{r:1, g:0, b:0},
		{r:0, g:1, b:0},
		{r:0, g:0, b:1},
		{r:1, g:1, b:0},
		{r:1, g:0, b:1},
		{r:0, g:1, b:1},
	]
	const baseRGB = getRandom(rgbArr);

	const numVariations = Math.floor(Math.random() * 5) + 3;
	const variations = [getRGBColor(baseRGB)]; // Start with the base color
	for (let i = 0; i < numVariations - 1; i++) {
		const cloneRGB = {...baseRGB};
		['r', 'g', 'b'].forEach(key => {
			const delta = Math.random() * 0.45, dir = baseRGB[key]?-1:1;
			cloneRGB[key] += delta * dir;
		});
		variations.push(getRGBColor(cloneRGB));
	}
	return variations;
}

function getRandom(arr) {
	return arr[Math.floor(Math.random() * arr.length)];
}

function getRGBColor(rgb) {
	const {r, g, b} = rgb,
		rNum = Math.floor(256*r),
		gNum = Math.floor(256*g),
		bNum = Math.floor(256*b);
	return new THREE.Color("rgb("+rNum+", "+gNum+", "+bNum+")");
}

function animate() {
	renderer.render(scene, camera);
	requestAnimationFrame(animate);
}
