"use strict"

// register the application module
b4w.register("slider_main", function(exports, require) {

	// import modules used by the app
	var m_app       = require("app");
	var m_cfg       = require("config");
	var m_data      = require("data");
	var m_preloader = require("preloader");
	var m_ver       = require("version");
	var m_scenes    = require("scenes");
	var m_ctl    = require("controls");
	var m_trans = require("transform");
	var m_cam = require("camera");
	var m_math = require("math");
	var m_phy = require("physics");
	var m_vec3 = require("vec3");
	var m_material = require("material");

	// detect application mode
	var DEBUG = (m_ver.type() == "DEBUG");

	// automatically detect assets path
	var APP_ASSETS_PATH = m_cfg.get_assets_path("slider");

	/**
	 * export the method to initialize the app (called at the bottom of this file)
	 */
	exports.init = function() {
		m_app.init({
			canvas_container_id: "main_canvas_container",
			callback: init_cb,
			show_fps: DEBUG,
			console_verbose: DEBUG,
			physics_enabled: true,
			autoresize: true
		});
	}

	/**
	 * callback executed when the app is initialized
	 */
	function init_cb(canvas_elem, success) {

		if (!success) {
			console.log("b4w init failure");
			return;
		}

		m_preloader.create_preloader();

		// ignore right-click on the canvas element
		canvas_elem.oncontextmenu = function(e) {
			e.preventDefault();
			e.stopPropagation();
			return false;
		};

		load();
	}

	/**
	 * load the scene data
	 */
	function load() {
		m_data.load(APP_ASSETS_PATH + "slider.json", load_cb, preloader_cb);
	}

	/**
	 * update the app's preloader
	 */
	function preloader_cb(percentage) {
		m_preloader.update_preloader(percentage);
	}

	/**
	 * callback executed when the scene data is loaded
	 */
	function load_cb(data_id, success) {

		if (!success) {
			console.log("b4w load failure");
			return;
		}

		var camObj = m_scenes.get_active_camera();
		var railObj = m_scenes.get_object_by_name("rail");
		var knobObj = m_scenes.get_object_by_name("knob");

		m_app.enable_camera_controls();

		registerSlider(railObj, knobObj, camObj, 0.3, ["rail", "slider-output2"], ["knob", "slider-output"]);

	}

	function b4wObjEqual(obj1, obj2) {
		if (obj1.uuid === obj2.uuid) {
			return true;
		}
		else {
			return false;
		}
	}


	function registerSlider(railObj, knobObj, camObj, defVal, railNodemat, knobNodemat ) {

		var sliderLength = m_trans.get_object_size(railObj) * 2;

		// sensor
		var mouseSensor = m_ctl.create_mouse_move_sensor();
		var clickSensor = m_ctl.create_mouse_click_sensor();

		// state
		var startTrans;
		var startCanvasX;
		var startCanvasY;

		// optimization state
		var from = new Float32Array(3);
		var pline = m_math.create_pline();
		var to = new Float32Array(3);

		var grabbedP = false;

		// init slider position
		m_trans.set_translation_obj_rel(knobObj, sliderLength * (defVal - 0.5), 0, 0.1, railObj);


		function slide(x, y) {

			function rayTestCb(id, hitFraction, objHit, hitTime, hitPos, hitNorm) {
				// objHit is always calculated against the center of mass.
				var normalizedOutput = hitPos[0] / sliderLength + 0.5;
				console.log(normalizedOutput);
				if (normalizedOutput > 0 && normalizedOutput < 1)
					m_trans.set_translation_obj_rel(knobObj, hitPos[0], 0, 0.1, railObj);
				if (railNodemat)
					m_material.set_nodemat_value(railObj, railNodemat, normalizedOutput);
				if (knobNodemat)
					m_material.set_nodemat_value(knobObj, knobNodemat, normalizedOutput);

			}

			m_cam.calc_ray(camObj, x, y, pline);
			m_math.get_pline_directional_vec(pline, to);
			m_vec3.scale(to, 100, to);
			var id = m_phy.append_ray_test_ext(
				camObj,
				from,
				to,
				"hud",
				rayTestCb,
				true,
				false,
				true,
				true
			);

		}

		function logic(triggers) {
			if (triggers[1])
				return 1;
			else
				return 0;
		}

		function cb(obj, id, pulse, param) {
			var pxPerFrame = m_ctl.get_sensor_value(obj, id, 0);
			var pos = m_ctl.get_sensor_payload(obj, id, 0);
			var click = m_ctl.get_sensor_payload(obj, id, 1);
			// derived
			var x = click.coords[0];
			var y = click.coords[1];

			if (grabbedP) {
				if (pulse === 1)
					slide(x, y);

				if (pulse === -1) {
					grabbedP = false;
					return;
				}
			}
			else if (!grabbedP) {
				if (click.which === 1) {
					obj = m_scenes.pick_object(x, y);
					if (obj !== null && b4wObjEqual(obj, railObj)) {
						grabbedP = true;
						startTrans = m_trans.get_translation(obj);
						startCanvasX = x;
						startCanvasY = y;
					}
				}
				else {
					return;
				}
			}

		};

		m_ctl.create_sensor_manifold(knobObj,
																 "mouse",
																 m_ctl.CT_CONTINUOUS,
																 [mouseSensor, clickSensor],
																 logic,
																 cb
																);
	}
});

// import the app module and start the app by calling the init method
b4w.require("slider_main").init();
