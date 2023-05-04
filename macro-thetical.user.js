// ==UserScript==
// @name         macro-thetical
// @namespace    http://paulbaker.io
// @version      0.6.6.1
// @description  Reads my macros, prints out how many I have left, and some hypothetical foods I can still eat with my allowance :)
// @author       Paul Nelson Baker, wguJohnKay, Xebeth
// @match        https://www.fitbit.com/foods/log
// @match        https://www.fitbit.com/foods/log/*
// @grant        GM_getValue
// @grant        GM_setValue
// @require      http://code.jquery.com/jquery-latest.js
// @downloadURL  https://github.com/Xebeth/macro-thectical/raw/master/macro-thetical.user.js
// @updateURL    https://github.com/Xebeth/macro-thectical/raw/master/macro-thetical.user.js
// ==/UserScript==

(function (jqueryInstance) {
    'use strict';

    Number.prototype.round = function(places = 2) {
        return +(Math.round(this + "e+" + places) + "e-" + places);
    }

    const MacroTastic = (function(jqueryInstance) {

        function MacroTastic(maxValuesDefaults) {
            this.maxValues = {};
            this.$ = jqueryInstance;
            this.maxValues.fat = Number(GM_getValue('macros-fat-goal')) || maxValuesDefaults.fat || 0;
            this.maxValues.carbs = Number(GM_getValue('macros-carbs-goal')) || maxValuesDefaults.carbs || 0;
            this.maxValues.protein = Number(GM_getValue('macros-protein-goal')) || maxValuesDefaults.protein || 0;
            // 1g fat = 9 Calories,
            // 1g Carbs or Protein = 4 calories.
            this.maxValues.dailyCalories = maxValuesDefaults.dailyCalories || (this.maxValues.fat * 9 + (this.maxValues.carbs + this.maxValues.protein) * 4);

            GM_setValue('macros-protein-goal', this.maxValues.protein);
            GM_setValue('macros-carbs-goal', this.maxValues.carbs);
            GM_setValue('macros-fat-goal', this.maxValues.fat);

            this.currentValues = {
                fat: 0,
                carbs: 0,
                fiber: 0,
                protein: 0,
                total: 0
            };

            this.processing = {};
            this.hideAfterLoad = {};

            jqueryInstance("body").on('DOMSubtreeModified', "#foodlog", () => {
                this.initialize();
            });
            this.initialize();
        }

        MacroTastic.prototype.scaleNutritionValue = function(value, ratio, regex, precision, elt) {
            const matches = value.match(regex);

            if (matches && matches.length > 1) {
                value = Number(matches[1]);

                if (value > 0) {
                    elt.text(matches.input.replace(matches[1], (value * ratio).round(precision)));
                }
            }
        };

        MacroTastic.prototype.toggleNutritionTooltip = function(event) {
            const elt = this.$(event.currentTarget);
            // retrieve the onclick attribute that contains the link to the food nutrition page
            const link = elt.attr('onclick');
            // extract the URL
            const matches = link.match(/window.location='(.*)'/);

            if (matches.length === 2) {
                const parentElt = elt.parent();
                // the food ID is the last part of the URL
                const foodID = matches[1].split('/').slice(-1);
                // the same food ID could be listed twice with different values
                const uniqueID = foodID + '-' + parentElt.parent().attr('id').split('_').splice(-1);
                // prevent processing the same food twice while the AJAX request is still processing
                if (this.processing[uniqueID]) {
                    // if we've left the hover area before the end of the processing, flag the tooltip as hidden
                    this.hideAfterLoad[uniqueID] = event.type === 'mouseleave';

                    return;
                }
                // check if the tooltip exists
                let foodInfo = this.$('#food-' + uniqueID);

                if (!foodInfo.length && event.type === 'mouseenter') {
                    // the tooltip doesn't exist
                    this.processing[uniqueID] = true;
                    // load the food nutrition page
                    this.$.ajax({url: matches[1]}).done((html) => {
                        const body = this.$('body');
                        const content = this.$(html);
                        // check if the CSS for the tooltip content already exists
                        let stylesheet = this.$('#foodInfoCSS');
                        // append the stylesheet to the body, if necessary
                        if (!stylesheet.length) {
                            // retrieve the link element
                            stylesheet = content.filter('link[href^="https://gcs-assets.fitbit.com/prod/app.foods.foodViewFood"]');

                            if (stylesheet.length) {
                                body.append(stylesheet.attr('id', 'foodInfoCSS'));
                            }
                        }
                        // retrieve the nutrition info div to use as the tooltip content
                        foodInfo = content.find('#contentBody .nutritionInfo .nutrition:first-child');
                        // scale the nutrition info for the current food
                        this.scaleNutritionInfo(foodInfo, parentElt);
                        // check if we need to hide the tooltip after a mouseleave event
                        const displayValue = this.hideAfterLoad[uniqueID] ? 'none' : 'block';
                        // create the tooltip container and position it under the food entry
                        const foodInfoContainer = this.$( `<div id="food-${uniqueID}" style="position: absolute; display: ${displayValue}; z-index:2; width: 303px; top: ${event.pageY + 16}px; left: ${event.pageX}px"></div>` );
                        // add the nutrition info div to the tooltip container
                        body.append(foodInfoContainer.html(foodInfo));
                        // remove the flags after processing
                        delete this.hideAfterLoad[uniqueID];
                        delete this.processing[uniqueID];
                    });
                } // the tooltip already exists
                else if (foodInfo.length) {
                    // if the mouse left the food entry
                    if (event.type === 'mouseleave') {
                        // hide the container
                        foodInfo.hide();
                    } // the mouse entered a food entry
                    else {
                        // scale the nutrition info for the current food
                        this.scaleNutritionInfo(foodInfo, elt.parent());
                        // reposition the tooltip container relative to the mouse and show it
                        foodInfo.css('top', (event.pageY + 16) + 'px').css('left', event.pageX + 'px').show();
                    }
                }
            }
        };

        MacroTastic.prototype.scaleNutritionInfo = function(foodInfo, parentElt) {
            // find all the nutrition values
            let servingRatio = 1;
            const caloriesElt = parentElt.siblings('.cols3');
            const mineralsPerc = foodInfo.find('.minerals td');
            const valuesHolders = foodInfo.find('.line .holder');
            const valuesPercHolders = foodInfo.find('.line .holder_strong');
            const calories = caloriesElt.text();

            valuesHolders.each((index, valueElt) => {
                const target = this.$(valueElt);
                let value = target.prop('innerText').trim();

                if (calories === value) {
                    return false;
                }
                else if (index === 0) {
                    servingRatio = Number(calories) / Number(value);
                    target.text(calories);
                }
                else if (value) {
                    this.scaleNutritionValue(value, servingRatio, /([0-9.,]+)([^0-9.,]*)/, 1, target);
                }
            });

            if (servingRatio !== 1) {
                valuesPercHolders.each((index, valueElt) => {
                    const target = this.$(valueElt);
                    let value = target.prop('innerText').trim();

                    this.scaleNutritionValue(value, servingRatio, /([0-9.,]+)([%])/, 0, target);
                });

                mineralsPerc.each((index, valueElt) => {
                    const target = this.$(valueElt);
                    let value = target.prop('innerText').trim();

                    this.scaleNutritionValue(value, servingRatio, /([0-9.,]+)([%])/, 0, target);
                });
            }

            foodInfo.find('.left_light_label').first().children('.holder').text(parentElt.siblings('.cols2').prop('innerText'));
        };

        MacroTastic.prototype.parseMacroValue = function (macroJQuerySelector) {
            const currentMacroElement = this.$(macroJQuerySelector);
            const currentMacroText = currentMacroElement.text();
            const currentMacroValue = parseFloat(currentMacroText.replace(/\s+g/gi, ''))
            return currentMacroValue;
        };

        MacroTastic.prototype.getRemainingMacros = function(maxValues) {
            const fatSelector = '#dailyTotals > div.content.firstBlock > div:nth-child(3) > div > div.amount';
            const carbsSelector = '#dailyTotals > div.content.firstBlock > div:nth-child(5) > div > div.amount';
            const fiberSelector = '#dailyTotals > div.content.firstBlock > div:nth-child(4) > div > div.amount';
            const proteinSelector = '#dailyTotals > div.content.firstBlock > div:nth-child(7) > div > div.amount';
            const caloriesSelector = '#dailyTotals > div.content.firstBlock > div:nth-child(2) > div > div.amount';

            this.currentValues.fat = this.parseMacroValue(fatSelector);
            this.currentValues.carbs = this.parseMacroValue(carbsSelector);
            this.currentValues.fiber = this.parseMacroValue(fiberSelector);
            this.currentValues.protein = this.parseMacroValue(proteinSelector);
            this.currentValues.total = this.parseMacroValue(caloriesSelector);

            return {
                'fat': maxValues.fat - this.currentValues.fat,
                'carbs': maxValues.carbs - this.currentValues.carbs,
                'protein': maxValues.protein - this.currentValues.protein,
                'total': maxValues.dailyCalories - this.currentValues.total,
            };
        };

        MacroTastic.prototype.createRowContainer = function() {
            // Create all the rows
            const customRowsSelector = 'div#my-custom-rows';

            if (this.$(customRowsSelector).length === 0 || this.$(customRowsSelector).is(":hidden")) {
                this.$('div#dailyTotals').append('<div id="my-custom-rows"></div>');
            }
        };

        MacroTastic.prototype.toggleRow = function(collapsed, toggleSpan) {
            const collapsible = toggleSpan.next();
            const heightValue = collapsed ? '0px' : '100%';
            const padding = collapsed ? '1px 21px 1px 19px' : '20px 21px 15px 19px';

            toggleSpan.text(collapsed ? '▼' : '▲');
            collapsible.css('height', heightValue).css('padding', padding);

            return collapsed;
        }

        MacroTastic.prototype.createRow = function (rowElementId, title, rowInitializerCallback) {
            this.createRowContainer();

            const customRowsElement = this.$('div#my-custom-rows');
            const selector = 'div#' + rowElementId;

            if (this.$(selector).length === 0) {
                customRowsElement.append(`<div id="${rowElementId}" class="container">
                    <span class="toggle" style="float:right;cursor:pointer;" title="${title}">🞁</span>
                    <div class="content" style="height:100%;overflow:hidden"></div>
                </div>`);
                const resultElement = this.$(selector);
                const hideSpan = resultElement.find(">:first-child");
                const collapsed = GM_getValue(rowElementId + '-state');

                hideSpan.click((e) => {
                    const collapsed = GM_getValue(rowElementId + '-state') || false;
                    const elt = this.$(e.currentTarget);

                    GM_setValue(rowElementId + '-state', this.toggleRow(!collapsed, elt));
                });

                if (collapsed) {
                    this.toggleRow(collapsed, hideSpan);
                }

                rowInitializerCallback(hideSpan.next(), title, rowElementId);
            }
        };

        MacroTastic.prototype.editGoal = function(event, macro) {
            const elt = this.$(event.currentTarget);
            const amount = GM_getValue('macros-'+ macro +'-goal') || elt.text();
            const input = this.$('<input style="max-width:64px" type="number" min="0" value="' + amount + '"></input>');

            event.preventDefault();

            input.on('change', (e) => {
                let newAmount = Number(input.val());

                newAmount = newAmount <= 0 ? 0 : newAmount;

                GM_setValue('macros-'+ macro +'-goal', newAmount);
                this.maxValues[macro] = newAmount;
                elt.text(newAmount);

                this.$('#my-max-calories-goal').text((this.maxValues.fat * 9 + (this.maxValues.carbs + this.maxValues.protein) * 4));
            }).on('blur', (e) => {
                input.remove();
                elt.show();
            });

            elt.hide().parent().prepend(input);
            input.focus().select();
        };

        MacroTastic.prototype.createColumn = function(rowID, substanceLabel, substanceAmount, substanceUnit, calorieAmount, totalAmount, editable) {
            const percentage = calorieAmount ? ((calorieAmount/totalAmount) * 100).round() : 0;
            const goalSpanID = rowID + '-' + substanceLabel.toLowerCase() + '-goal';
            const valueElement = editable ? 'a' : 'span';
            const attrs = editable ? 'href="#"' : '';
            const htmlValue = `
    <div class="total">
      <div class="label">
        <div class="substance">${substanceLabel} (${percentage}%)</div>
        <div class="amount">
          <${valueElement} ${attrs} id="${goalSpanID}">${substanceAmount.round()}</${valueElement}> <span class="unit"> ${substanceUnit}</span>
        </div>
       </div>
    </div>
    `;
            return this.$(htmlValue);
        };

        MacroTastic.prototype.initialize = function() {
            // init mouse over of food items
            jqueryInstance('.foodLink').hover((e) => this.toggleNutritionTooltip(e));

            this.createRow('adjusted-totals', 'Adjusted Macros', (rowElement, title, rowID) => {
                const adjustedCalories = this.currentValues.total - this.currentValues.fiber * 4;

                rowElement.append(this.$('<h3>' + title + '</h3>'));
                rowElement.append(this.createColumn(rowID, 'Calories', adjustedCalories , 'kCal', adjustedCalories, adjustedCalories));
                rowElement.append(this.createColumn(rowID, 'Fat', this.currentValues.fat, 'g', this.currentValues.fat * 9, adjustedCalories));
                rowElement.append(this.createColumn(rowID, 'Carbs', (this.currentValues.carbs - this.currentValues.fiber), 'g', (this.currentValues.carbs - this.currentValues.fiber) * 4, adjustedCalories));
                rowElement.append(this.createColumn(rowID, 'Fibers', this.currentValues.fiber, 'g', this.currentValues.fiber * 4, adjustedCalories));
                rowElement.append(this.createColumn(rowID, 'Protein', this.currentValues.protein, 'g', this.currentValues.protein * 4, adjustedCalories));
            });

            this.createRow('my-max', 'Max Macros', (rowElement, title, rowID) => {
                rowElement.append(this.$('<h3>' + title + '</h3>'));
                rowElement.append(this.createColumn(rowID, 'Calories', this.maxValues.dailyCalories, 'kCal', this.maxValues.dailyCalories, this.maxValues.dailyCalories));
                rowElement.append(this.createColumn(rowID, 'Fat', this.maxValues.fat, 'g', this.maxValues.fat * 9, this.maxValues.dailyCalories, true));
                rowElement.append(this.createColumn(rowID, 'Carbs', this.maxValues.carbs, 'g', this.maxValues.carbs * 4, this.maxValues.dailyCalories, true));
                rowElement.append(this.createColumn(rowID, 'Protein', this.maxValues.protein, 'g', this.maxValues.protein * 4, this.maxValues.dailyCalories, true));

                this.$('#' + rowID + '-protein-goal').click((e) => this.editGoal(e, 'protein'));
                this.$('#' + rowID + '-carbs-goal').click((e) => this.editGoal(e, 'carbs'));
                this.$('#' + rowID + '-fat-goal').click((e) => this.editGoal(e, 'fat'));

            });

            this.createRow('my-remainders', 'Remaining Macros', (rowElement, title, rowID) => {
                const remainingMacros = this.getRemainingMacros(this.maxValues);
                rowElement.append(this.$('<h3>' + title + '</h3>'));
                rowElement.append(this.createColumn(rowID, 'Calories', remainingMacros.total, 'kCal', remainingMacros.total, this.maxValues.dailyCalories));
                rowElement.append(this.createColumn(rowID, 'Fat', remainingMacros.fat, 'g', remainingMacros.fat * 9, this.maxValues.fat * 9));
                rowElement.append(this.createColumn(rowID, 'Carbs', remainingMacros.carbs, 'g', remainingMacros.carbs * 4, this.maxValues.carbs * 4));
                rowElement.append(this.createColumn(rowID, 'Protein', remainingMacros.protein, 'g', remainingMacros.protein * 4, this.maxValues.protein * 4));
            });
        };

        return MacroTastic;
    })(jqueryInstance);

    // lets make this script an object so we can encapsulate everything and pass the maxValues object as a param when we initiate
    /*
         My macros are based on my body height/type/shape and my
         fitness goals. Get yours from your personal trainer or online calculator :)

         Here is a popular calculator: https://ketogains.com/ketogains-calculator/
     */
    new MacroTastic({
        fat: 98,
        carbs: 363,
        protein: 216
    });
})(jQuery);
