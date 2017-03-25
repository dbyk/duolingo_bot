
String.prototype.clearAnswer = function(){
	return this.replace(new RegExp(/\./), '');
};
String.prototype.hashCode = function (str) {
	var hash = 0,
		i, chr;
	
	if (str.length === 0) return hash;
	
	for (i = 0; i < str.length; i++) {
		chr   = str.charCodeAt(i);
		hash  = ((hash << 7) - hash * 2) + chr;
		hash |= 0; // Convert to 32bit integer
	}
	return hash;
};


var solveInterval,
		slowSkipping = false,
		solving_lock = false,
		current_task_text = '',
		current_task = '',
		current_task_list;

var tasks = [
	'Переведите текст:',
	'Заполните пропуск',
	'Введите то, что слышите',
	'Отметьте <em class="underline">все правильные</em> переводы'
];

var answers = [
	['Yo como', 'Я ем'],
	['Yo como pan', 'Я ем хлеб'],
	['Yo como una manzana', 'Я ем яблоко'],
	['Yo bebo', 'Я пью'],
	['Yo bebo agua', 'Я пью воду'],
	['Yo bebo leche', 'Я пью молоко'],
	['Yo soy un niño', 'Я мальчик'],
	['Yo soy una niña', 'Я девочка'],
	['Yo soy una mujer', 'Я женщина'],
	
	['Tú bebes leche', 'Ты пьёшь молоко'],
	['Tú bebes el agua', 'Ты пьёшь воду'],
	['Tú comes una manzana', 'Ты ешь яблоко'],
	['Tú comes pan', 'Ты ешь хлеб'],
	['Tú comes', 'Ты ешь'],
	['Tú eres una niña', 'Ты девочка'],
	['Tú eres un niño', 'Ты мальчик'],
	['Tú eres un hombre', 'Ты человек'],
	
	['El hombre bebe leche', 'Мужчина пьёт молоко'],
	['El hombre bebe el agua', 'Мужчина пьёт воду'],
	['El hombre la mujer', 'Мужчина, женщина'],
	['Él es un hombre', 'Он человек'],
	['Él es un niño', 'Он мальчик'],
	['El niño la niña', 'Мальчик девочка'],
	['El niño bebe la leche', 'Мальчик пьёт молоко'],
	
	['Ella bebe', 'Она пьёт'],
	['Ella come una manzana', 'Она ест яблоко'],
	['Ella come la manzana', 'Она ест яблоко'],
	['Ella come', 'Она ест'],
	['Ella es una niña', 'Она девочка'],
	
	['Usted come', 'Вы едите'],
	['Usted come pan', 'Вы едите хлеб'],
	['Usted bebe', 'Вы пьёте'],
	
	['Un niño un hombre', 'Мальчик, мужчина'],
	['Un hombre', 'Мужчина'],
	['Una niña una mujer', 'Одна девочка одна женщина'],
	['Una mujer', 'Женщина'],
	['La mujer bebe agua', 'Женщина пьёт воду'],
	
	
	['Кто мой адвокат', 'Quién es mi abogado'],
	['Девочка', 'La niña'],
	['Девочка', 'Una niña'],
	['Женщина', 'La mujer'],
	['Мальчик', 'Un niño'],
	['Он ест', 'El come'],
	
	
	['Yo  agua.', 'bebo'],
	['Yo  pan.', 'como'],
	['Yo  leche.', 'bebo'],
	['La niña  leche.', 'bebe'],
	['Yo soy  niña.', 'una'],
	['Tú  leche.', 'bebes'],
	['Yo  una manzana.', 'como'],
	['Tú  el agua.', 'bebes'],
	['Yo  una niña.', 'soy'],
	['Tú  agua.', 'bebes'],
	
	
	[' come.', 'El'],
	
	['Женщина пьёт воду', 'Die Frau trinkt Wasser'],
	['Eine Frau trinkt Wasser', 'Женщина пьёт воду']
];

function findAnswer(key) {
	key = key.clearAnswer();
	for (var i = 0; i < answers.length; i++) {
		if (answers[i][0] == key) {
			return answers[i][1];
		}
		if (answers[i][1] == key) {
			return answers[i][0];
		}
	}
	return null;
}

function findAnswers(key) {
	key = key.clearAnswer();
	var res = [];
	for (var i = 0; i < answers.length; i++) {
		if (answers[i][0] == key) {
			res.push(answers[i][1]);
		}
		if (answers[i][1] == key) {
			res.push(answers[i][0]);
		}
	}
	return res;
}

var supports_local_storage = function () {
	try {
		return 'localStorage' in window && window['localStorage'] !== null;
	} catch (e) {
		return false;
	}
}
var useLocal = supports_local_storage();

// Translation section

function init() {
	if (useLocal) {
		var t_answers = JSON.parse(localStorage.getItem('duo.answers'));
		if (t_answers !== null) {
			for (var i = 0; i < t_answers.length; i++) {
				var t = findAnswer(t_answers[i][0]);
				if (t === null) {
					answers.push(t_answers[i]);
				}
			}
		}
	}
	start();
}

function saveAnswers() {
	if (useLocal) {
		localStorage.setItem("duo.answers", JSON.stringify(answers));
	}
}

function addAnswer(answer) {
	var answer_f = answer;
	if (current_task == tasks[1]) {
		var w1 = current_task_text.split(' '),
			w2 = answer.split(' '),
			i = 0, j = 0;
		while (i < w1.length && j < w2.length) {
			if (w1[i] == w2[j]) {
				i++; j++;
				continue;
			}
			answer_f = w2[j];
			i += 100;
		}
	}
	answer_f.clearAnswer();
	answers.push([current_task_text, answer_f]);
	console.log('adding answer for "' + current_task_text + '" : "' + answer_f + '"');
	saveAnswers();
}

function findPhrase() {
	var i = 0,
			wordId = '#token_0',
			words = [];
	
	while ($(wordId).length > 0) {
		words.push($(wordId).html());
		wordId = '#token_' + ++i;
	}
	return words.join(' ').clearAnswer();
}

function solveTranslation() {
	var phrase = findPhrase();
	console.log('founded phrase : "' + phrase + '"');
	current_task_text = phrase;
	var answer = findAnswer(phrase);
	if (answer === null) {
		return skip();
	}
	$('#text-input').val(answer);
	$('#text-input').keyup();
	nextStep();
}

// Blank section

function findBlankPhrase(p) {
	var tt = p.clone();
	tt.find('label').remove();
	return tt.html().clearAnswer();
}

function findBlankPronoun(select, answer) {
	var opts = $(select).find('option');
	
	if (answer == 'El' || answer == 'Ellos') {
		for (var i = 0; i < opts.length; i++) {
			var ht = $(opts[i]).html();
			if (ht === 'El' || ht === 'Ella' || ht === 'Usted' ||
					ht === 'Ellos' || ht === 'Ellas' || ht === 'Ustedes') {
				return ht;
			}
		}
	}
	return answer;
}

function solveBlank(p) {
	var phrase = findBlankPhrase(p);
	console.log('founded phrase: "' + phrase + '"');
	current_task_text = phrase;
	var select;
	
	for (var i = 0; i < 5; i++) {
		select = $('#options_' + i);
		if (select.length > 0)
		{
			break;
		}
		select = '';
	}
	
	if (select === '') {
		return skip();
	}
	
	var answer = findBlankPronoun(select, findAnswer(phrase));
	
	if (answer === null)
	{
		return skip();
	}
	$(select).val(answer);
	$(select).change();
	nextStep();
}

// Checkboxed section

function solveCheckbox(p) {
	var phrase = $(p).html().clearAnswer();
	console.log('founded phrase : "' + phrase + '"');
	var t_answers = findAnswers(phrase);
	var lis = $('div.col-right').find('li.item');
	var skip = 'skip';
	for (var i = 0; i < lis.length; i++) {
		for (var j = 0; j < t_answers.length; j++) {
			if ($(lis[i]).find('bdi').html() == t_answers[j]) {
				$('#sentence-' + i).click();
				skip = '';
			}
		}
	}
	nextStep(skip);
}

// audition section

function solveAudition(p) {
	//https://d7mj4aqfscim2.cloudfront.net/tts/{voice}/sentence/ee6cfc133e801b3f6eaf88db5be9a171
	var parts = p.split('/');
	var id = parts[parts.length - 1];
	current_task_text = id;
	var answer = findAnswer(id);
	if (answer === null) {
		return skip();
	}
	$('#word-input').val(answer);
	$('#word-input').keyup();
	setTimeout(nextStep, 1000);
}

function solve(task) {
	solving_lock = true;
	if (task == tasks[0]) {
		console.log('try to solve translation task');
		solveTranslation();
	} else if (task == tasks[1]) {
		console.log('try to solve blank task');
		solveBlank($('#session-element-container').find('h2.player'));
	} else if (task == tasks[2]) {
		//console.log('Skipping audio task :(');
		console.log('try to solve audition task');
		var div = $('#big-speaker').find('div.hidden');
		if (div !== undefined) {
			solveAudition($(div[0]).attr('src'));
		}
		nextStep('skip');
	} else if (task == tasks[3]) {
		console.log('try to solve checkbox task');
		solveCheckbox($('.col-left').find('bdi'));
	} else {
		current_task_text = '';
		skip();
	}
}


function analyzeResult() {
	var res = $('#grade').find('bdi.blame_solution');
	if (res.length > 0) {
		if ($('#grade').find('span.icon-wrong-big').length > 0) {
			var answer = $(res).html();
			console.log('The answer was "' + answer + '"');
			addAnswer(answer);
		}
	}
}

function printDict() {
	for (var i = 0; i < answers.length; i++) {
		console.log('[\'' + answers[i][0] + '\',\'' + answers[i][0] + '\'],');
	}
}

function start() {
	startSolve(1000);
}

function stop() {
	if (solveInterval > 0) {
		stopSolve();
		console.log('We are finished');
	}
}

function stopSolve() {
	if (solveInterval > 0) {
		clearInterval(solveInterval);
		solveInterval = 0;
	}
}

function startSolve(timeout) {
	stopSolve();
	solving_lock = false;
	solveInterval = setInterval(function(){ autoSolve(); }, timeout);
}

function nextSolve(timeout) {
	setTimeout(function(){ solving_lock = false; }, timeout);
}

function skip() {
	nextStep('skip');
}

function nextStep(next)
{
	var timeout = slowSkipping ? 3000 : 1000;
	var btnId =  '#next_button';
	if (next == 'skip') {
		btnId = '#skip_button';
	}
	$(btnId).click();
	setTimeout(function(){ analyzeResult() }, timeout);
	setTimeout(function(){ $('#next_button').click(); }, timeout * 2);
	nextSolve(timeout * 3);
}

function autoSolve() {
	if (solving_lock) {
		return;
	}
	var task_tag = $('#session-element-container').find('h1.player');
	if (task_tag.length > 0) {
		current_task = task_tag.html();
		console.log('task is ' + current_task);
		solve(current_task);
	} else {
		stop();
	}
}