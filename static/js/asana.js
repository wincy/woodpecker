Function.prototype.partial = function() {
    var fn = this, args = Array.prototype.slice.call(arguments);
    return function(){
	var arg = 0;
	for ( var i = 0; i < args.length && arg < arguments.length; i++ )
            if ( args[i] === undefined )
		args[i] = arguments[arg++];
	return fn.apply(this, args);
    };
};

Asana = function(ns) {
    this.ns = ns;
    this.Task.find = this.Task.find.bind(this);
    this.Project.find = this.Project.find.bind(this);
    this.Workspace.find = this.Workspace.find.bind(this);
}

Asana.prototype = {
    request: function(url, params) {
	url = this.ns + url;
	if (typeof params === undefined) {
	    params = {};
	}
	var key = JSON.stringify([url, params]);
	var promise = new RSVP.Promise(function(resolve, reject){
	    var cached_value = locache.get(key);
	    if (cached_value) {
		resolve(cached_value);
	    } else {
		$.get(url, params)
		    .success(function(data) {
			locache.set(key, data.data);
			resolve(data.data);
		    })
		    .fail(function() {
			reject(this);
		    });
	    }
	});
	return promise;
    },
    Task: {
	find: function(conds) {
	    return this.request('/tasks', conds).then(function(data) {
		return data.map(function(elem) {
		    return new Asana.Task(elem.id);
		});
	    });
	},
    },
    Project: {
	find: function(conds) {
	    return this.request('/projects', conds).then(function(data) {
		return data.map(function(elem) {
		    return new Asana.Project(elem.id);
		});
	    });
	},
    },
    Workspace: {
	find: function(conds) {
	    return this.request('/workspaces', conds).then(function(data) {
		return data.map(function(elem) {
		    return new Asana.Workspace(elem.id);
		});
	    });
	},
    },
}

Asana.Workspace = function(id) {
    this.id = id;
    this.name = null;
}

Asana.Workspace.prototype = {
    load: function() {
	return asana.request('/workspaces/' + this.id).then(function(data) {
	    this.name = data.name;
	}.bind(this));
    },
}

Asana.Task = function(id) {
    this.id = id;
    this.Story.find = this.Story.find.bind(this);
}

Asana.Task.prototype = {
    load: function() {
	return asana.request('/tasks/' + this.id).then(function(data) {
	    for (var key in data) {
		this[key] = data[key];
	    }
	    return this;
	}.bind(this));
    },
    Story: {
	find: function(conds) {
	    return asana.request('/tasks/' + this.id + '/stories').map(function(elem) {
		return new Asana.Story(this, 'tasks', elem.id);
	    }.bind(this));
	}
    }
}

Asana.Story = function(target, target_type, id) {
    this.target = target;
    this.target_type = target_type;
    this.id = id;
    this.type = null;
    this.text = null;
}

Asana.Story.prototype = {
    load: function() {
	return asana.request('/' + this.target_type + '/stories/' + this.id)
	    .then(function(data) {
		this.text = data.text;
		this.type = data.type;
	    }.bind(this));
    },
}
