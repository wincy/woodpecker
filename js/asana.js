Asana = function(url, api_key) {
    this.url = url;
    this.api_key = api_key;
}

Asana.prototype = {
    get_workspace_tasks: function(workspace, filters, callback) {
	$.get(this.url + '/workspaces/' + workspace + '/tasks', filters, callback);
    },
}
