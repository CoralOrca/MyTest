var camera, scene, renderer, controls, tWidth, tHeight, totalGroup, modelGroup, oldColor, selMesh;

const raycaster = new THREE.Raycaster(), mouse = new THREE.Vector2(), meshArr = [], camDis = 10;

let randColors = generateVariations();
let object;

let mixer, IdleAction, LLeftAction, LRightAction, WalkAction, WalkSTAction, WalkSPAction, RunAction, RunSTAction, RunSPAction;
const clock = new THREE.Clock();
const animationState = {
	st_idle: true,
    st_walk: false,
    st_run: false,
	st_LLeft: false, // Changed to false
    st_LRight: false, // Changed to false
    played_LLeft: false, // Track if LLeft has been played
    played_LRight: false, // Track if LRight has been played
};

let lastRotationTime = Date.now();
let lastInteractionTime = Date.now();

$(document).ready(function () {
    setTotalSize();
    init();
    loadModel();
    animate();
    moveCameraForward();

	const dropArea = document.getElementById('dropArea');
	dropArea.addEventListener('dragover', handleDragEvent('dragging', true));
	dropArea.addEventListener('dragleave', handleDragEvent('dragging', false));
	dropArea.addEventListener('drop', handleDrop);

    const fileInput = document.getElementById('fileInput');
    fileInput.addEventListener('change', (e) => handleFileSelection(e), false);

    // Set the "idle" radio button as checked on page load
    const idleAnimationRadio = document.getElementById('idleAnimation');
    idleAnimationRadio.checked = true;
    animationState.st_idle = true;
    animationState.st_walk = false;
    animationState.st_run = false;
    animationState.st_LLeft = false;
    animationState.st_LRight = false;

    // Array of animation state names and corresponding radio button IDs
    const animationStates = [
        { name: 'st_idle', radioId: 'idleAnimation' },
        { name: 'st_walk', radioId: 'walkAnimation' },
        { name: 'st_run', radioId: 'runAnimation' },
        { name: 'st_LLeft', radioId: 'lookLeftAnimation' },
        { name: 'st_LRight', radioId: 'lookRightAnimation' },
    ];

    // Get references to the radio buttons and set initial checked state
    animationStates.forEach(state => {
        state.radio = document.getElementById(state.radioId);
        state.radio.checked = state.name === 'st_idle';
    });

    // Add event listeners to the radio buttons
    animationStates.forEach(state => {
        state.radio.addEventListener('change', function() {
            animationStates.forEach(s => {
                animationState[s.name] = (s.name === state.name);
            });
            updateAnimationState();
        });
    });

    const inputColor = document.getElementById('inputColor');
    inputColor.addEventListener('change', e => applyColor(e), false);
    inputColor.addEventListener('input', e => applyColor(e), false);
});

function init() {
	const container = document.getElementById('container');
	renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setSize(tWidth, tHeight);
	container.appendChild(renderer.domElement);
	renderer.setClearColor(0x181818, 1);
	scene = new THREE.Scene();
	camera = new THREE.PerspectiveCamera(60, tWidth / tHeight, 0.01, camDis*10); 							// Camera
	camera.position.set(0, 0, camDis/2);
	controls = new THREE.OrbitControls(camera, renderer.domElement); 										// Controls
	controls.minDistance = camDis / 4;
	controls.maxDistance = camDis *2;
	const ambient = new THREE.AmbientLight(0xFFFFFF, 1); scene.add(ambient); 								// Lights
	const mainLight = new THREE.DirectionalLight( 0xFFFFFF, 0.85); mainLight.position.set( -1, 1, 1 ); scene.add( mainLight );

	totalGroup = new THREE.Group(); scene.add(totalGroup);

	window.addEventListener('resize', onWindowResize,false);
	container.addEventListener('pointerup',  onMouseClick,  false);

	const dropArea = document.getElementById('dropArea');
	dropArea.addEventListener('dragover', handleDragEvent('dragging', true));
	dropArea.addEventListener('dragleave', handleDragEvent('dragging', false));
	dropArea.addEventListener('drop', handleDrop);

    // Add a click event listener to trigger the click event on the file input
    dropArea.addEventListener('click', () => {
        const fileInput = document.getElementById('fileInput');
        fileInput.click();
    });
}

function loadModel(colorsExtracted, object) {
	const loader = new THREE.GLTFLoader();

	loader.load( '../models/FullBody_walk_010.gltf', function ( gltf ) {
		object = gltf.scene;
		//animation
		mixer = new THREE.AnimationMixer (object);
		const clips = gltf.animations;

		IdleAction = mixer.clipAction (THREE.AnimationClip.findByName(clips, 'lego_idle'));

		LLeftAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, 'lego_look_left'));
		LLeftAction.timeScale = 0.1;
		LLeftAction.loop = THREE.LoopOnce; // Set to loop only once
		LLeftAction.clampWhenFinished = true; // Clamp to the last frame after finishing
	
		LRightAction = mixer.clipAction(THREE.AnimationClip.findByName(clips, 'lego_look_right'));
		LRightAction.timeScale = 0.1;
		LRightAction.loop = THREE.LoopOnce; // Set to loop only once
		LRightAction.clampWhenFinished = true; // Clamp to the last frame after finishing
	
        RunAction = mixer.clipAction (THREE.AnimationClip.findByName(clips, 'lego_run'));
		RunSTAction = mixer.clipAction (THREE.AnimationClip.findByName(clips, 'lego_run_start'));
		RunSPAction = mixer.clipAction (THREE.AnimationClip.findByName(clips, 'lego_run_stop'));
		
		WalkAction = mixer.clipAction (THREE.AnimationClip.findByName(clips, 'lego_walk'));
		WalkSTAction = mixer.clipAction (THREE.AnimationClip.findByName(clips, 'lego_walk_start'));
		WalkSPAction = mixer.clipAction (THREE.AnimationClip.findByName(clips, 'lego_walk_stop'));	
		
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
						child.material = new THREE.MeshStandardMaterial({ color: 0x000000,  roughness: 0.8, metalness: 0.5 }); //black
					} else {
						child.material = new THREE.MeshStandardMaterial({ color: 0xFFFFFF,  roughness: 0.8, metalness: 0.5 }); //white
					}
				} 
				else {
					// Find the corresponding color from the colorsExtracted array based on the index
					const index = meshArr.indexOf(child);
					if (index !== -1 && index < colorsExtracted.length) {
						child.material = new THREE.MeshStandardMaterial({
							color: colorsExtracted[index],
							roughness: 0.8, metalness: 0.5 
						});
					} 
					
					else {
						// Fallback to random color from the randColors array if no corresponding color is found
						const randomCol = randColors[Math.floor(Math.random() * randColors.length)];
						child.material = new THREE.MeshStandardMaterial({
							color: randomCol,
							roughness: 0.8, metalness: 0.5 
						});
					}
				}
				meshArr.push(child);
			}
		});
		totalGroup.add( object );
		totalGroup.position.y=-2;

	}, undefined, undefined );
}

function animate() {
    renderer.render(scene, camera);
    TWEEN.update(); // Update the Tween.js animations
    requestAnimationFrame(animate);
    if (mixer) mixer.update(clock.getDelta());

    // Check for inactivity and activate orbit effect
    const currentTime = Date.now();
    const timeDifference = currentTime - lastInteractionTime;

    if (timeDifference >= 30000) { // after 30s
        // Rotate the model around its Y axis
        const rotationSpeed = 0.0025; // Adjust the rotation speed as needed
        totalGroup.rotation.y += rotationSpeed;
    }
    // Update animation state
    updateAnimationState();
}

function updateAnimationState() {
    if (WalkAction && RunAction) {
        if (animationState.st_walk) {
            WalkAction.play();
            RunAction.stop();
            IdleAction.stop();
            LLeftAction.stop();
            LRightAction.stop();
        } else if (animationState.st_run) {
            WalkAction.stop();
            IdleAction.stop();
			RunAction.play();
            LLeftAction.stop();
            LRightAction.stop();
        } else if (animationState.st_idle) {
            WalkAction.stop();
            RunAction.stop();
            IdleAction.play();
            LLeftAction.stop();
            LRightAction.stop();
        } else if (animationState.st_LRight) {
            if (!animationState.played_LRight) { // Play only once
                LLeftAction.stop(); // Stop LLeft if playing
                LRightAction.play();
                animationState.played_LRight = true; // Mark as played
            }

        } else if (animationState.st_LLeft) {
            if (!animationState.played_LLeft) { // Play only once
                LRightAction.stop(); // Stop LRight if playing
                LLeftAction.play();
                animationState.played_LLeft = true; // Mark as played
            }

        } else {
            WalkAction.stop();
            RunAction.stop();
            IdleAction.play();
            LLeftAction.stop();
            LRightAction.stop();
        }
    }

	    // Reset played flags when changing animation state
		if (!animationState.st_LLeft) {
			animationState.played_LLeft = false;
		}
		if (!animationState.st_LRight) {
			animationState.played_LRight = false;
		}
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
	lastInteractionTime = Date.now();
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
		{r:1, g:0, b:0},{r:0, g:1, b:0},{r:0, g:0, b:1},{r:1, g:1, b:0},{r:1, g:0, b:1},{r:0, g:1, b:1}, {r:204, g:153, b:0}, {r:200, g:200, b:200},        
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

// Drag and Drop
function handleDrop(event) {
	event.preventDefault();
	const file = event.dataTransfer.files[0];
	if (file.type.startsWith('image/')) {
	  const reader = new FileReader();
	  reader.onload = function (e) {
		const img = new Image();
		img.onload = function () {
		  const originalWidth = 1000;
		  const originalHeight = 1000;
		  const wRatio = img.width / originalWidth;
		  const hRatio = img.height / originalHeight;
  
		  const locations = [	

			[320 * wRatio, 320 * hRatio], [430 * wRatio, 320 * hRatio], [580 * wRatio, 320 * hRatio], [690 * wRatio, 320 * hRatio],
			[320 * wRatio, 320 * hRatio], [430 * wRatio, 320 * hRatio], [580 * wRatio, 320 * hRatio], [690 * wRatio, 320 * hRatio], // Row 1

			[320 * wRatio, 430 * hRatio], [320 * wRatio, 430 * hRatio], [320 * wRatio, 430 * hRatio], [320 * wRatio, 430 * hRatio], // Eyes Back
			[320 * wRatio, 430 * hRatio], [430 * wRatio, 430 * hRatio], [580 * wRatio, 430 * hRatio], [690 * wRatio, 430 * hRatio], // Eyes Front
		  
			[320 * wRatio, 560 * hRatio], [430 * wRatio, 560 * hRatio], [580 * wRatio, 560 * hRatio], [690 * wRatio, 560 * hRatio],
			[320 * wRatio, 560 * hRatio], [430 * wRatio, 560 * hRatio], [580 * wRatio, 560 * hRatio], [690 * wRatio, 560 * hRatio], // Row 3
		  
			[320 * wRatio, 690 * hRatio], [430 * wRatio, 690 * hRatio], [580 * wRatio, 690 * hRatio], [690 * wRatio, 690 * hRatio],
			[320 * wRatio, 690 * hRatio], [430 * wRatio, 690 * hRatio], [580 * wRatio, 690 * hRatio], [690 * wRatio, 690 * hRatio], // Row 4
			//-------------------------------------------------------------------------------------------------------------------------------------

			/*hand*/[320 * wRatio, 430 * hRatio], [320 * wRatio, 940 * hRatio], [320 * wRatio, 940 * hRatio], // Arm Right backSide
	
			[690 * wRatio, 940 * hRatio], [690 * wRatio, 940 * hRatio], /*hand*/[320 * wRatio, 430 * hRatio], //Arm Left backSide

			/*hand*/[320 * wRatio, 430 * hRatio], [320 * wRatio, 940 * hRatio], [320 * wRatio, 940 * hRatio], // Arm Right frontside
			[690 * wRatio, 940 * hRatio], [690 * wRatio, 940 * hRatio], /*hand*/[320 * wRatio, 430 * hRatio], // Arm Left frontside

			[430 * wRatio, 940 * hRatio], [580 * wRatio, 940 * hRatio], [430 * wRatio, 940 * hRatio], [580 * wRatio, 940 * hRatio], // Body
			[430 * wRatio, 940 * hRatio], [580 * wRatio, 940 * hRatio], [430 * wRatio, 940 * hRatio], [580 * wRatio, 940 * hRatio],
		  
			[320 * wRatio, 940 * hRatio], [320 * wRatio, 940 * hRatio], [760 * wRatio, 225 * hRatio], [760 * wRatio, 225 * hRatio], // Feet + legs
		  ];
		  analyzeImageColors(e.target.result, locations.reverse());
		};
		img.src = e.target.result;
	  };
	  reader.readAsDataURL(file);
	}
}

function handleDragEvent(className, addClass) {
    return function(event) {
        event.preventDefault();
        if (addClass) {
            dropArea.classList.add(className);
        } else {
            dropArea.classList.remove(className);
        }
    };
}

// Select file from computer
function handleFileSelection(event) {
    const file = event.target.files[0];
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const img = new Image();
		img.onload = function () {
		  const originalWidth = 1000;
		  const originalHeight = 1000;
		  const wRatio = img.width / originalWidth;
		  const hRatio = img.height / originalHeight;
  
		  const locations = [	

			[320 * wRatio, 320 * hRatio], [430 * wRatio, 320 * hRatio], [580 * wRatio, 320 * hRatio], [690 * wRatio, 320 * hRatio],
			[320 * wRatio, 320 * hRatio], [430 * wRatio, 320 * hRatio], [580 * wRatio, 320 * hRatio], [690 * wRatio, 320 * hRatio], // Row 1

			[320 * wRatio, 430 * hRatio], [320 * wRatio, 430 * hRatio], [320 * wRatio, 430 * hRatio], [320 * wRatio, 430 * hRatio], // Eyes Back
			[320 * wRatio, 430 * hRatio], [430 * wRatio, 430 * hRatio], [580 * wRatio, 430 * hRatio], [690 * wRatio, 430 * hRatio], // Eyes Front
		  
			[320 * wRatio, 560 * hRatio], [430 * wRatio, 560 * hRatio], [580 * wRatio, 560 * hRatio], [690 * wRatio, 560 * hRatio],
			[320 * wRatio, 560 * hRatio], [430 * wRatio, 560 * hRatio], [580 * wRatio, 560 * hRatio], [690 * wRatio, 560 * hRatio], // Row 3
		  
			[320 * wRatio, 690 * hRatio], [430 * wRatio, 690 * hRatio], [580 * wRatio, 690 * hRatio], [690 * wRatio, 690 * hRatio],
			[320 * wRatio, 690 * hRatio], [430 * wRatio, 690 * hRatio], [580 * wRatio, 690 * hRatio], [690 * wRatio, 690 * hRatio], // Row 4
			//-------------------------------------------------------------------------------------------------------------------------------------

			/*hand*/[320 * wRatio, 430 * hRatio], [320 * wRatio, 940 * hRatio], [320 * wRatio, 940 * hRatio], // Arm Right backSide
	
			[690 * wRatio, 940 * hRatio], [690 * wRatio, 940 * hRatio], /*hand*/[320 * wRatio, 430 * hRatio], //Arm Left backSide

			/*hand*/[320 * wRatio, 430 * hRatio], [320 * wRatio, 940 * hRatio], [320 * wRatio, 940 * hRatio], // Arm Right frontside
			[690 * wRatio, 940 * hRatio], [690 * wRatio, 940 * hRatio], /*hand*/[320 * wRatio, 430 * hRatio], // Arm Left frontside

			[430 * wRatio, 940 * hRatio], [580 * wRatio, 940 * hRatio], [430 * wRatio, 940 * hRatio], [580 * wRatio, 940 * hRatio], // Body
			[430 * wRatio, 940 * hRatio], [580 * wRatio, 940 * hRatio], [430 * wRatio, 940 * hRatio], [580 * wRatio, 940 * hRatio],
		  
			[320 * wRatio, 940 * hRatio], [320 * wRatio, 940 * hRatio], [760 * wRatio, 225 * hRatio], [760 * wRatio, 225 * hRatio], // Feet + legs
		  ];
		  analyzeImageColors(e.target.result, locations.reverse());
		};
		img.src = e.target.result;
	  };
	  reader.readAsDataURL(file);
	}
}

function analyzeImageColors(imageDataUrl, locations) {
	const img = new Image();
	img.onload = function () {
	  const canvas = document.createElement('canvas');
	  const ctx = canvas.getContext('2d');
	  const colorsExtracted= [];
  
	  canvas.width = img.width;
	  canvas.height = img.height;
	  ctx.drawImage(img, 0, 0, img.width, img.height);
  
	  for (const [x, y] of locations) {
		const pixelData = ctx.getImageData(x, y, 1, 1).data;
		const color = new THREE.Color("rgb(" + pixelData[0] + ", " + pixelData[1] + ", " + pixelData[2] + ")");
		colorsExtracted.push(color);
		//console.log(`Color at (${x}, ${y}): R=${pixelData[0]}, G=${pixelData[1]}, B=${pixelData[2]}`);
	  }
	  colorsExtracted.reverse();
	  console.log(colorsExtracted);
	  applyColorsToMeshes(colorsExtracted);
	}
	img.src = imageDataUrl;
}

  function applyColorsToMeshes(colorsExtracted) {
	meshArr.forEach((mesh, index) => {
		if (index < colorsExtracted.length) {
			mesh.material.color.copy(colorsExtracted[index]);
		} else {
			const randomCol = randColors[Math.floor(Math.random() * randColors.length)];
			mesh.material.color.copy(randomCol);
		}
	});
}

function moveCameraForward() {
    // Initial camera position
    const initialPosition = { z: camDis * 2 };
    
    // Target camera position
    const targetPosition = { z: camDis / 2 };
    
    // Create a tween
    const tween = new TWEEN.Tween(initialPosition)
        .to(targetPosition, 2000) // Duration is 3000ms (3 seconds)
        .easing(TWEEN.Easing.Quadratic.InOut) // Easing function for smooth movement
        .onUpdate(() => {
            camera.position.z = initialPosition.z;
        })
        .start();
}