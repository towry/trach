
/**
 * @module layer
 *
 * Layer is the unit of this chart library.
 */

var Pin = require('./Pin');
var inherit = require('../utils/inherit');
var is = require('../utils/is');
var mergeIntoMulti = require('../utils/merge-into-multi');

var hasOwn = Object.prototype.hasOwnProperty;
var OWNER_KEY = '{owner}';
var OWNER_POLICY = '{policy}';

function Layer (name) {
	// if (!(master instanceof Trach)) {
	// 	throw new TypeError("Layer master must be a Trach instance");
	// }
	Pin.call(this);
	
	this.name = name || 'unknow(layer)';
	this._childs = [];
}
inherit(Layer, Pin);

Layer.prototype.render = function () {
	return null;
}

Layer.prototype.update = function () {
}

Layer.prototype.init = function () {
}

Layer.prototype.children = function () {
	return this._childs;
}

Layer.prototype.contextReceiveChange = function (/** ctx */) {
}

Layer.prototype.append = function (layer) {
	if (!(layer instanceof Layer)) {
		throw new TypeError("Layer instance is required.");
	}

	setOwner(layer, this);
	this._childs.push(layer);
}


// Layer.prototype.dnode = function () {
// 	return this.get('dnode');
// }

Layer.prototype.context = function () {
	return {};
}

// Layer.prototype.getLayer = function (layerName) {
// 	if (!this._master) {
// 		throw new Error("This layer does not have a controller");
// 	}

// 	return this._master.getLayer(layerName);
// }

// Layer.prototype.root = function () {
// 	return this.getLayer(this._master.getRootIndex());
// }


function createLayer(name, defs) {
	var nextConstruct = function () {
		var args = Array.prototype.slice.call(arguments);
		// if (!args.length) {
		// 	throw new TypeError("Missing something in layer: " + name);
		// }

		args.unshift(name);
		Layer.apply(this, args);
	};

	inherit(nextConstruct, Layer);

	if (!is.isObject(defs)) {
		throw new TypeError("Invalid argument.");
	}

	var prop = nextConstruct.prototype;
	for (var m in defs) {
		if (hasOwn.call(defs, m)) {
			if (m === 'context') {
				prop[m] = createChainedMethodForContext(defs[m]);
			} else {
				prop[m] = defs[m];
			}
		}
	}

	prop.render = createChainedMethodForRender(defs.render || prop.render);
	return nextConstruct;
}

/**
 * Create a chained method for the layer to be called.
 */
function createChainedMethodForRender(method) {
	return function () {

		this.init();

		var value = method.call(this);
		// call update after render if there is a data
		if (this.context().data) {
			this.update();
		}

		// the value is the return of render.
		if (value) {
			this.set('selection', value);
		} else if (value !== null) {
			throw new Error("[" + this.name + "] render method must return a d3 node or null value.");
		}

		renderLayerChildren(this);
		return value;
	}
}

/**
 * Render the childs of the layer.
 */
function renderLayerChildren(layer) {
	var childs = layer._childs;
	childs.forEach(function (child) {
		child.render();
	});
}

/**
 * Create a chained method for the layer to be called
 * to get a context.
 */
function createChainedMethodForContext(method) {
	/**
	 * TODO: add cache, add context change notify.
	 */
	return function () {
		var owner = getOwner(this);
		if (!owner) {
			throw new Error("The layer doesn't have a owner.");
		}

		var contextPolicy = method.call(null);
		if (!is.isObject(contextPolicy)) {
			throw new Error("The context method of layer must return an object");
		}

		attachContextPolicyToOwner(owner, contextPolicy);

		var evaluated = evaluateContext(owner, Object.keys(contextPolicy));
		// call the receive change handler
		this.contextReceiveChange(evaluated);
		return evaluated;
	}
}

/** 
 * Attach the context policy to the layer.
 */
function attachContextPolicyToOwner(owner, policy) {
	owner[OWNER_POLICY] = owner[OWNER_POLICY] || {};
	mergeIntoMulti(owner[OWNER_POLICY], policy);
}

/**
 * Evaluate context from owner.
 */
function evaluateContext(owner, keys) {
	var evaluated = {};

	keys.forEach(function (key) {
		evaluated[key] = owner.get(key) || throwIfAgainstPolicy(owner, key);
	})

	// inject optional.
	evaluated['data'] = owner.get('data');
	evaluated['selection'] = owner.get('selection');
	
	return evaluated;
}

function throwIfAgainstPolicy(owner, key) {
	if (!hasPolicyOfKey(owner, key)) {
		return null;
	}

	var policy = getPolicy(owner)[key];
	if (!is.isArray(policy)) {
		policy = [policy];
	}

	console.error("policy error: [" + owner.name + "] must provide following pins: " + policy.join(';'));
}

/**
 * Check the layer have a policy by the key.
 */
function hasPolicyOfKey(owner, key) {
	if (!owner[OWNER_POLICY] || !(key in owner[OWNER_POLICY])) return false;
	return  true;
}

/**
 * Get policy from the layer.
 */
function getPolicy(layer) {
	return layer[OWNER_POLICY];
}

/**
 * Set up the owner of this layer.
 */
function setOwner(layer, owner) {
	layer[OWNER_KEY] = owner;
}

/**
 * Get the owner of this layer.
 */
function getOwner(layer) {
	return layer[OWNER_KEY];
}

module.exports = createLayer;
