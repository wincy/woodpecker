define("asana/store", ["ember"], function() {
    Store = Ember.Object.extend({
	bucket: {},
	get: function(klass, id) {
	    if (this.bucket[klass._singular] && this.bucket[klass._singular][id]) {
		return this.bucket[klass._singular][id];
	    } else {
		var instance = klass.create({id: id});
		if (!this.bucket[klass._singular]) {
		    this.bucket[klass._singular] = {};
		}
		this.bucket[klass._singular][id] = instance;
		return instance;
	    }
	},
    });

    return Store;
});
