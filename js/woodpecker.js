var timepicker = new TimePicker("#time-picker");
var timeline = new Timeline("#timeline");

function check_in(ts) {
    $("#history").append("<tr><td>" + new Date() + "</td><td></td></tr>");
}

function check_out(ts) {
    $('#history tr :last-child').last().text(new Date());
}

$(document).ready(function () {
    timepicker.init()
    $("#check-in").tap(function () {
	timeline.check_in();
    });
    $("#check-out").tap(function () {
	timeline.check_out();
    });
    $("#time-cancel").tap(function () {
	$("#time-picker").hide();
    });
    $("#add-check-in").tap(function () {
	timepicker.ask("Add check in", function(ts) {
	    timeline.add_check_in(ts);
	});
    });
    $("#add-check-out").tap(function () {
	timepicker.ask("Add check out", function(ts) {
	    timeline.add_check_out(ts);
	});
    });
});
