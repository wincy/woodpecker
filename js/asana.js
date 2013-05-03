Asana = function(url) {
    this.url = url;
    this._workspaces = {};
}

var getJSON = function(url) {
    var promise = new RSVP.Promise(function(resolve, reject){
	var cached_value = locache.get(url);
	if (cached_value) {
	    callback(cached_value);
	} else {
	    var client = new XMLHttpRequest();
	    client.open("GET", url);
	    client.onreadystatechange = handler;
	    client.responseType = "json";
	    client.setRequestHeader("Accept", "application/json");
	    client.send();
	    function handler() {
		if (this.readyState === this.DONE) {
		    if (this.status === 200) {
			locache.set(url, this.response);
			resolve(this.response);
		    } else {
			reject(this);
		    }
		}
	    };
	}
    });
    return promise;
};

Asana.prototype = {
    workspaces: function(value) {
	var key = null;
	if (typeof value == 'string') {
	    key = 'name';
	} else if (typeof value == 'int') {
	    key = 'id';
	}
	var results = this._workspaces.filter(function(elem) {
	    return elem[key] == value;
	});
	if (results.length == 1)
	    return results[0];
    },
    get_workspaces: function(callback) {
	var workspaces = this.workspaces;
	getJSON(this.url + '/workspaces/', '', function(data) {
	    workspaces = data;
	    callback(workspaces);
	});
    },
    get_workspace_tasks: function(workspace, options, callback) {
	getJSON(this.url + '/workspaces/' + workspace + '/tasks',
		   options, callback);
    },
    post_task_story: function(task, content, callback) {
	$.post(this.url + '/tasks/' + task + '/stories',
	       {text: content}, callback);
    },
}
