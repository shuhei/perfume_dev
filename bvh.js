var CHANNELS = {
  X_POSITION: 1,
  Y_POSITION: 2,
  Z_POSITION: 3,
  X_ROTATION: 4,
  Y_ROTATION: 5,
  Z_ROTATION: 6
};

var __bind = function(fn, me) {
  return function() {
    return fn.apply(me, arguments);
  };
};

var Node = (function() {
  function Node(name, parent) {
    this.name = name;
    this.parent = parent;
    this.children = [];
    this.channels = [];
    this.initialOffset = new THREE.Vector3();
    this.translation = new THREE.Vector3();
    this.rotation = new THREE.Vector3();
  }
  Node.prototype.isRoot = function() {
    return !this.parent;
  };
  Node.prototype.isSite = function() {
    return this.children.length === 0;
  };
  Node.prototype.update = function(index, frame) {
    this.translation.set(0, 0, 0);
    this.rotation.set(0, 0, 0);
    for (var i = 0; i < this.channels.length; i++) {
      var channel = this.channels[i],
          v = frame[index];
      if (channel === CHANNELS.X_POSITION) {
        this.translation.x = v;
      } else if (channel === CHANNELS.Y_POSITION) {
        this.translation.y = v;
      } else if (channel === CHANNELS.Z_POSITION) {
        this.translation.z = v;
      } else if (channel === CHANNELS.X_ROTATION) {
        this.rotation.x = v * Math.PI / 180;
      } else if (channel === CHANNELS.Y_ROTATION) {
        this.rotation.y = v * Math.PI / 180;
      } else if (channel === CHANNELS.Z_ROTATION) {
        this.rotation.z = v * Math.PI / 180;
      }
      index++;
    }

    this.translation.addSelf(this.initialOffset);

    for (var i = 0; i < this.children.length; i++) {
      index = this.children[i].update(index, frame);
    }

    return index;
  };
  Node.prototype.cout = function(indent) {
    if (!indent) {
      indent = "";
    }
    console.log(indent + this.name + " " +
      this.channels.length + " channels " +
      "(" + this.initialOffset.x + ", " + this.initialOffset.x + ", " + this.initialOffset.z + ")"
    );
    for (var i = 0; i < this.children.length; i++) {
      this.children[i].cout("  " + indent);
    }
  };

  return Node;
})();

var Bvh = (function() {
  function Bvh(root) {
    this.root = root;
    this.frames = [];
    this.joints = [];
  }
  Bvh.prototype.update = function(pos) {
    if (pos >= 0 && pos < this.frames.length) {
      var frame = this.frames[pos];
      this.root.update(0, frame);
    }
  };
  
  return Bvh;
})();

var Parser = (function() {
  function Parser(data) {
    this.data = data;
  }
  Parser.prototype.parse = function() {
    var lines = this.data.split("\n"),
        i = 0,
        bvh,
        joint,
        done = false;
    while (line = lines[i++]) {
      line = line.replace(/^\s+|\s+$/, "");
      var fields = line.split(" ");
      switch (fields[0]) {
        case "ROOT":
          joint = new Node(fields[1]);
          bvh = new Bvh(joint);
          bvh.joints.push(joint);
          break;
        case "JOINT":
        case "End":
          joint = new Node(fields[1], joint);
          joint.parent.children.push(joint);
          bvh.joints.push(joint);
          break;
        case "OFFSET":
          var ox = parseFloat(fields[1]),
              oy = parseFloat(fields[2]),
              oz = parseFloat(fields[3]);
          joint.initialOffset.set(ox, oy, oz);
          break;
        case "CHANNELS":
          if (fields.length > 2) {
            for (var j = 2; j < fields.length; j++) {
              var field = fields[j];
              if (field === "Xposition") {
                joint.channels.push(CHANNELS.X_POSITION);
              } else if (field === "Yposition") {
                joint.channels.push(CHANNELS.Y_POSITION);
              } else if (field === "Zposition") {
                joint.channels.push(CHANNELS.Z_POSITION);
              } else if (field === "Xrotation") {
                joint.channels.push(CHANNELS.X_ROTATION);
              } else if (field === "Yrotation") {
                joint.channels.push(CHANNELS.Y_ROTATION);
              } else if (field === "Zrotation") {
                joint.channels.push(CHANNELS.Z_ROTATION);
              }
            }
          }
          break;
        case "}":
          joint = joint.parent;
          if (!joint) {
            done = true;
          }
          break;
      }
      if (done) {
        break;
      }
    }
    
    var frameCount;
    while (line = lines[i++]) {
      var fields = line.split(" ");
      if (fields[0] === "Frames:") {
        frameCount = parseInt(fields[1]);
      } else if (fields[0] === "Frame") {
        bvh.frameTime = parseFloat(fields[2]);
        break;
      }
    }

    while (line = lines[i++]) {
      var fields = line.split(" "),
          frame = [];
      if (fields.length > 0) {
        for (var j = 0; j < fields.length; j++) {
          frame.push(parseFloat(fields[j]));
        }
        bvh.frames.push(frame);
      }
    }

    if (frameCount !== bvh.frames.length) {
      throw "Invalid frames!";
    }

    return bvh;
  };
  return Parser;
})();

jQuery(function($) {
  var perfume = new Perfume();
  perfume.init();
  
  $(document).mousemove(__bind(perfume.onMouseMove, perfume));

  var loaded = 0;
  function loadBvh(path) {
    $.get(path, function(data) {
      var parser = new Parser(data);
      bvh = parser.parse();
      bvh.update();
      bvh.root.cout();
      
      perfume.addBvh(bvh);

      loaded++;
      if (loaded === 4) {
        perfume.start();
      }
    });
  }
  loadBvh("bvhfiles/aachan.bvh");
  loadBvh("bvhfiles/kashiyuka.bvh");
  loadBvh("bvhfiles/nocchi.bvh");
  
  var soundPlayer = new SoundPlayer();
  perfume.audio = soundPlayer;
  soundPlayer.init(function() {
    loaded++;
    if (loaded === 4) {
      perfume.start();
    }
  });
});

var SoundPlayer = (function() {
  function SoundPlayer() {
    
  }
  SoundPlayer.prototype.init = function(callback) {
    this.context = new (window.AudioContext || window.webkitAudioContext)();
    
    var self = this;
    var xhr = new XMLHttpRequest();
    xhr.open('GET', "Perfume_globalsite_sound.wav", true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function() {
      self.context.decodeAudioData(xhr.response, function(buffer) {
        self.source = self.context.createBufferSource();
        self.source.buffer = buffer;
        self.source.connect(self.context.destination);
        callback();
      }, function() {
        console.log("Failed to load sounds.");
      });
    };
    xhr.send();    
  };
  SoundPlayer.prototype.play = function() {
    this.source.noteOn(0);
  };
  SoundPlayer.prototype.isReady = function() {
    return !!this.source;
  };
  
  return SoundPlayer;
})();

var Perfume = (function() {
  function Perfume() {
    this.objects = [];
    this.radius = 300;
    this.theta = 0;
    this.mouseX = 0;
    this.mouseY = 0;
    this.bvhs = [];
    
    this.prevPos = 1000000;
  }
  
  Perfume.prototype.start = function() {
    this.startTime = new Date().getTime();
    this.animate();
  };

  Perfume.prototype.addBvh = function(bvh) {
    this.bvhs.push(bvh);
    bvh.objects = [];
    this.addNode(bvh.root, this.scene, bvh.objects);
  };

  Perfume.prototype.init = function() {
    this.container = document.createElement('div');
    document.body.appendChild(this.container);
    
    this.scene = new THREE.Scene();
    
    // Add camera
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 1, 10000);
    this.camera.position.set(0, 300, 500);
    this.scene.add(this.camera);
    
    // Add lights
    var light = new THREE.DirectionalLight(0xffffff, 2);
    light.position.set(1, 1, 1).normalize();
    this.scene.add(light);

    var light = new THREE.DirectionalLight(0xffffff);
    light.position.set(-1, -1, -1).normalize();
    this.scene.add( light );

    this.projector = new THREE.Projector();

    // Add renderer
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.sortObjects = false;
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.container.appendChild(this.renderer.domElement);

    // Add stats
    this.stats = new Stats();
    this.stats.domElement.style.position = 'absolute';
    this.stats.domElement.style.top = '0px';
    this.container.appendChild(this.stats.domElement);
  };
  
  Perfume.prototype.addNode = function(joint, parentNode, objects) {
    var color;
    if (joint.isRoot()) {
      color = 0xff0000;
    } else if (joint.isSite()) {
      color = 0xffff00;
    } else {
      color = 0x000000;
    }
    var geometry = new THREE.CubeGeometry(5, 5, 5);    
    var material = new THREE.MeshLambertMaterial({ color: color });
    var object = new THREE.Mesh(geometry, material);
    object.eulerOrder = 'YXZ';
    
    parentNode.add(object);
    objects.push(object);

    for (var i = 0; i < joint.children.length; i++) {
      this.addNode(joint.children[i], object, objects);
    }
  };
  
  Perfume.prototype.animate = function() {
    window.requestAnimationFrame(__bind(this.animate, this));

    var dt = new Date().getTime() - this.startTime,
        frameCount = this.bvhs[0].frames.length,
        frameTime = this.bvhs[0].frameTime,
        pos = Math.floor(dt / 1000.0 / frameTime) % frameCount;
    
    if (pos < this.prevPos && this.audio.isReady()) {
      this.audio.play();
    }
    this.prevPos = pos;

    for (var i = 0; i < this.bvhs.length; i++) {
      var bvh = this.bvhs[i];
      bvh.update(pos);
      
      for (var j = 0; j < bvh.joints.length; j++) {
        var object = bvh.objects[j];
        var joint = bvh.joints[j];
        
        object.position.copy(joint.translation);
        object.rotation.copy(joint.rotation);
      }
    }

    this.render();
    this.stats.update();
  };

  Perfume.prototype.render = function() {
    var $window = $(window);
    this.camera.position.x = this.radius * this.mouseX / $window.width();
    this.camera.position.y = this.radius * this.mouseY / $window.height();

    this.camera.lookAt(this.scene.position);

    this.renderer.render(this.scene, this.camera);
  };

  Perfume.prototype.onMouseMove = function(e) {
    this.mouseX = e.pageX;
    this.mouseY = e.pageY;
  };

  return Perfume;
})();
