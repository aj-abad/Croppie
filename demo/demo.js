var Demo = (function() {

	function output(node) {
		var existing = document.querySelector('#result .croppie-result');
		if (existing) {
			existing.parentNode.replaceChild(node, existing);
		}
		else {
			document.getElementById('result').appendChild(node);
		}
	}

	function popupResult(result) {
		var html;
		if (result.html) {
			html = result.html;
		}
		if (result.src) {
			html = '<img src="' + result.src + '" />';
		}
		swal({
			title: '',
			html: true,
			text: html,
			allowOutsideClick: true
		});
		setTimeout(function(){
			var alert = document.querySelector('.sweet-alert');
			if (alert) {
				var top = -1 * (alert.offsetHeight / 2);
				var left = -1 * (alert.offsetWidth / 2);
				alert.style.margin = top + 'px 0 0 ' + left + 'px';
			}
		}, 1);
	}

	function demoMain () {
		var el = document.getElementById('cropper-1');
		var mc = new Croppie(el, {
			viewport: {
				width: 150,
				height: 150,
				type: 'circle'
			},
			boundary: {
				width: 300,
				height: 300
			},
			// url: 'demo/demo-1.jpg',
			// enforceBoundary: false
			// mouseWheelZoom: false
		});
		el.addEventListener('update', function (ev) {
			// console.log('update', ev.detail);
		});
		document.querySelector('.js-main-image').addEventListener('click', function (ev) {
            mc.result({
				type: 'rawcanvas',
				circle: true,
				// size: { width: 300, height: 300 },
            	format: 'png'
            }).then(function (canvas) {
				popupResult({
					src: canvas.toDataURL()
				});
			});
		});
	}

	function demoBasic() {
		var wInput = document.querySelector('.basic-width');
		var hInput = document.querySelector('.basic-height');
		var el = document.getElementById('demo-basic');
		var basic = new Croppie(el, {
			viewport: {
				width: 150,
				height: 200
			},
			boundary: {
				width: 300,
				height: 300
			}
		});
		basic.bind({
			url: 'demo/cat.jpg',
			points: [77,469,280,739]
		});

		document.querySelector('.basic-result').addEventListener('click', function() {
			var w = parseInt(wInput.value, 10);
			var h = parseInt(hInput.value, 10);
			var size = 'viewport';
			if (w || h) {
				size = { width: w, height: h };
			}
			basic.result({
				type: 'canvas',
				size: size,
				resultSize: {
					width: 50,
					height: 50
				}
			}).then(function (resp) {
				popupResult({
					src: resp
				});
			});
		});
	}

	function demoVanilla() {
		var vEl = document.getElementById('vanilla-demo'),
			vanilla = new Croppie(vEl, {
			viewport: { width: 200, height: 100 },
			boundary: { width: 300, height: 300 },
			showZoomer: false,
            enableOrientation: true
		});
		vanilla.bind({
            url: 'demo/demo-2.jpg',
            orientation: 4,
            zoom: 0
        });
        vEl.addEventListener('update', function (ev) {
        	// console.log('vanilla update', ev);
        });
		document.querySelector('.vanilla-result').addEventListener('click', function (ev) {
			vanilla.result({
				type: 'blob'
			}).then(function (blob) {
				popupResult({
					src: window.URL.createObjectURL(blob)
				});
			});
		});

		var rotateButtons = document.querySelectorAll('.vanilla-rotate');
		for (var i = 0; i < rotateButtons.length; i++) {
			rotateButtons[i].addEventListener('click', function(ev) {
				vanilla.rotate(parseInt(this.getAttribute('data-deg')));
			});
		}
	}

    function demoResizer() {
		var vEl = document.getElementById('resizer-demo'),
			resize = new Croppie(vEl, {
			viewport: { width: 100, height: 100 },
			boundary: { width: 300, height: 300 },
			showZoomer: false,
            enableResize: true,
            enableOrientation: true,
            mouseWheelZoom: 'ctrl'
		});
		resize.bind({
            url: 'demo/demo-2.jpg',
            zoom: 0
        });
        vEl.addEventListener('update', function (ev) {
        	console.log('resize update', ev);
        });
		document.querySelector('.resizer-result').addEventListener('click', function (ev) {
			resize.result({
				type: 'blob'
			}).then(function (blob) {
				popupResult({
					src: window.URL.createObjectURL(blob)
				});
			});
		});
	}

	function demoUpload() {
		var uploadCrop;

		function readFile(input) {
 			if (input.files && input.files[0]) {
	            var reader = new FileReader();
	            
	            reader.onload = function (e) {
					document.querySelector('.upload-demo').classList.add('ready');
	            	uploadCrop.bind({
	            		url: e.target.result
	            	}).then(function(){
	            		console.log('bind complete');
	            	});
	            	
	            }
	            
	            reader.readAsDataURL(input.files[0]);
	        }
	        else {
		        swal("Sorry - you're browser doesn't support the FileReader API");
		    }
		}

		var el = document.getElementById('upload-demo');
		uploadCrop = new Croppie(el, {
			viewport: {
				width: 100,
				height: 100,
				type: 'circle'
			},
			enableExif: true
		});

		document.getElementById('upload').addEventListener('change', function () { readFile(this); });
		document.querySelector('.upload-result').addEventListener('click', function (ev) {
			uploadCrop.result({
				type: 'canvas',
				size: 'viewport'
			}).then(function (resp) {
				popupResult({
					src: resp
				});
			});
		});
	}

	function demoHidden() {
		var el = document.getElementById('hidden-demo');
		var hiddenCrop = new Croppie(el, {
			viewport: {
				width: 175,
				height: 175,
				type: 'circle'
			},
			boundary: {
				width: 200,
				height: 200
			}
		});
		hiddenCrop.bind('demo/demo-3.jpg');
		document.querySelector('.show-hidden').addEventListener('click', function () {
			el.style.display = el.style.display === 'none' ? '' : 'none';
			hiddenCrop.bind();
		});
	}

	function bindNavigation () {
		var navLinks = document.querySelectorAll('nav a');
		for (var i = 0; i < navLinks.length; i++) {
			navLinks[i].addEventListener('click', function (ev) {
				var href = this.getAttribute('href');
				var target = document.querySelector('a[name="' + href.substring(1) + '"]');
				if (target) {
					var targetTop = target.getBoundingClientRect().top + window.pageYOffset;
					window.scrollTo({ top: targetTop, behavior: 'smooth' });
				}
				ev.preventDefault();
			});
		}
	}

	function init() {
		bindNavigation();
		demoMain();
		demoBasic();	
		demoVanilla();	
		demoResizer();
		demoUpload();
		demoHidden();
	}

	return {
		init: init
	};
})();


// Full version of `log` that:
//  * Prevents errors on console methods when no console present.
//  * Exposes a global 'log' function that preserves line numbering and formatting.
(function () {
  var method;
  var noop = function () { };
  var methods = [
      'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
      'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
      'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
      'timeStamp', 'trace', 'warn'
  ];
  var length = methods.length;
  var console = (window.console = window.console || {});
 
  while (length--) {
    method = methods[length];
 
    // Only stub undefined methods.
    if (!console[method]) {
        console[method] = noop;
    }
  }
 
 
  if (Function.prototype.bind) {
    window.log = Function.prototype.bind.call(console.log, console);
  }
  else {
    window.log = function() { 
      Function.prototype.apply.call(console.log, console, arguments);
    };
  }
})();
