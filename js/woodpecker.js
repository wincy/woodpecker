Woodpecker = Ember.Application.create({
    LOG_TRANSITIONS: true,
    ready: function () {
	console.log('init');
    },
});
Woodpecker.ApplicationController = Ember.Controller.extend({
    world: "world!",
});
Woodpecker.Button = Ember.ObjectController.extend({});
Woodpecker.ButtonView = Ember.View.extend({
    templateName: 'button',
});
Woodpecker.PopupView = Ember.View.extend({
    layoutName: 'popup'
});
Woodpecker.Record = Ember.ObjectController.extend({
});
Woodpecker.TimelineView = Ember.View.extend({
    templateName: "timeline",
});
Woodpecker.TimelineController = Ember.ArrayController.create({
    content: [],
    init: function() {
	this.pushObject(Woodpecker.Record.create({start: "00:01", end: "00:12"}));
	this.pushObject(Woodpecker.Record.create({start: "00:21", end: "00:32"}));
	this.pushObject(Woodpecker.Record.create({start: "00:33", end: "00:45"}));
    }
});
Woodpecker.timepicker = Ember.Object.create({
    value: null,
    Cursor: Woodpecker.Button.extend({
	hit: function() {
	    Woodpecker.timepicker.cursors.jump(this);
	},
    }),
    CursorView: Ember.View.extend({
	templateName: 'timepicker-cursor',
    }),
    NumpadButton: Woodpecker.Button.extend({
	hit: function() {
	    switch (this.type) {
	    case "set-single":
		Woodpecker.timepicker.cursors.set_current(this.text);
		Woodpecker.timepicker.cursors.next();
		break;
	    case "set-minutes":
		Woodpecker.timepicker.cursors.mset(3, 2, this.text.slice(1));
		break;
	    case "reset":
		Woodpecker.timepicker.cursors.reset();
		break;
	    case "now":
		var now = new Date();
		Woodpecker.timepicker.cursors.mset(0, 2, sprintf("%02d", now.getHours()));
		Woodpecker.timepicker.cursors.mset(3, 2, sprintf("%02d", now.getMinutes()));
		break;
	    default:
		console.log('unhandled event');
	    }
	},
    }),
    NumpadButtonView: Ember.View.extend({
	templateName: 'timepicker-button',
    }),
    ControlButton: Woodpecker.Button.extend({
	hit: function() {
	    switch (this.type) {
	    case "cancel":
		Woodpecker.timepicker.view.set('isVisible', false);
		break;
	    case "confirm":
		var ts = new Date();
		var hours = parseInt(Woodpecker.timepicker.cursors.mget(0, 2).join(''));
		var minutes = parseInt(Woodpecker.timepicker.cursors.mget(3, 2).join(''));
		ts.setHours(hours);
		ts.setMinutes(minutes);
		Woodpecker.timepicker.set('value', ts);
		Woodpecker.timepicker.view.set('isVisible', false);
		break;
	    default:
		console.log('unhandled event');
	    }
	},
    }),
    ControlButtonView: Woodpecker.ButtonView.extend({
	templateName: 'button',
    }),
})
Woodpecker.timepicker.cursors = Ember.ArrayController.create({
    content: [],
    current: 0,
    init: function() {
	var cursors = [{fixed: false, current: true, value: "1"},
		       {fixed: false, current: false, value: "2"},
		       {fixed: true, current: false, value: ":"},
		       {fixed: false, current: false, value: "3"},
		       {fixed: false, current: false, value: "4"}].map(function (elem) {
			   return Woodpecker.timepicker.Cursor.create(elem);
		       });
	this.set('content', cursors);
    },
    reset: function() {
	var variables = this.content.filter(function (elem) {
	    return elem.fixed == false;
	});
	this.jump(variables[0]);
    },
    set_current: function(value) {
	this.content[this.current].set('value', value);
    },
    mget: function(start, offset) {
	return this.content.slice(start, offset).map(function () {
	    return this.value;
	});
    },
    mset: function(start, offset, values) {
	for (var i = 0; i < offset; i++) {
	    this.content[start + i].set('value', values[i]);
	}
    },
    next: function() {
	var variables = this.content.filter(function (elem) {
	    return elem.fixed == false;
	});
	var idx = (variables.indexOf(this.content[this.current]) + 1) % variables.length;
	this.jump(variables[idx]);
    },
    jump: function(to_cursor) {
	this.content[this.current].set('current', false);
	to_cursor.set('current', true);
	this.set('current', this.content.indexOf(to_cursor));
    },
});
Woodpecker.timepicker.numpad_buttons = Ember.ArrayController.create({
    content: [],
    init: function() {
	var buttons = [{text: "1", type: "set-single"},
		       {text: "2", type: "set-single"},
		       {text: "3", type: "set-single"},
		       {text: ":15", type: "set-minutes"},
		       {text: "4", type: "set-single"},
		       {text: "5", type: "set-single"},
		       {text: "6", type: "set-single"},
		       {text: ":30", type: "set-minutes"},
		       {text: "7", type: "set-single"},
		       {text: "8", type: "set-single"},
		       {text: "9", type: "set-single"},
		       {text: ":45", type: "set-minutes"},
		       {text: "reset", type: "reset"},
		       {text: "0", type: "set-single"},
		       {text: "now", type: "now"},
		       {text: ":00", type: "set-minutes"}].map(function (elem) {
			   return Woodpecker.timepicker.NumpadButton.create(elem);
		       });
	this.set('content', buttons);
    },
});
Woodpecker.timepicker.control_buttons = Ember.ArrayController.create({
    content: [],
    init: function() {
	var buttons = [{text: "Cancel", type: "cancel"},
		       {text: "Confirm", type: "confirm"}].map(function(elem) {
			   return Woodpecker.timepicker.ControlButton.create(elem);
		       });
	this.set('content', buttons);
    }
});
Woodpecker.timepicker.view = Ember.View.create({
    templateName: "timepicker",
    isVisible: false,
});
Woodpecker.puncher = Ember.Object.create({
    Button: Woodpecker.Button.extend({
	hit: function() {
	    switch (this.type) {
	    case "check-in":
		break;
	    case "check-out":
		break;
	    case "add-check-in":
		Woodpecker.timepicker.view.set('isVisible', true);
		break;
	    case "add-check-out":
		Woodpecker.timepicker.view.set('isVisible', true);
		break;
	    default:
		console.log('unhandled event');
	    }
	},
    }),
    ButtonView: Ember.View.extend({
	templateName: 'button',
    }),
});
Woodpecker.puncher.buttons = Ember.ArrayController.create({
    content: [],
    init: function() {
	var buttons = [
	    {text: "Check in", type: "check-in"},
	    {text: "Check out", type: "check-out"},
	    {text: "Add check in", type: "add-check-in"},
	    {text: "Add check out", type: "add-check-out"}].map(function (elem) {
		return Woodpecker.puncher.Button.create(elem);
	});
	this.set('content', buttons);
    },
});
Woodpecker.puncher.view = Ember.View.create({
    templateName: "puncher",
});
