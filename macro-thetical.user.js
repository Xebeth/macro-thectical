// ==UserScript==
// @name         macro-thetical
// @namespace    http://paulbaker.io
// @version      0.6
// @description  Reads my macros, prints out how many I have left, and some hypothetical foods I can still eat with my allowance :)
// @author       Paul Nelson Baker, wguJohnKay, Xebeth
// @match        https://www.fitbit.com/foods/log
// @match        https://www.fitbit.com/foods/log/*
// @grant        none
// @require      http://code.jquery.com/jquery-latest.js
// @downloadURL  https://github.com/Xebeth/macro-thectical/raw/master/macro-thetical.user.js
// @updateURL    https://github.com/Xebeth/macro-thectical/raw/master/macro-thetical.user.js
// ==/UserScript==

(function (jqueryInstance) {
    'use strict';

    let MacroTastic = (function(jqueryInstance) {

        function MacroTastic(maxValues) {
            let self = this;
            self.maxValues = {};
            self.maxValues.fat = maxValues.fat || 0;
            self.maxValues.carbs = maxValues.carbs || 0;
            self.maxValues.protein = maxValues.protein || 0;
            self.maxValues.dailyCalories = maxValues.dailyCalories || 0;

            self.currentValues = {
                fat: 0,
                carbs: 0,
                fiber: 0,
                protein: 0,
                total: 0
            };

            self.$ = jqueryInstance;
            self.$("body").on('DOMSubtreeModified', "#foodlog", () => {
                self.initializeCustomRows();
            });
            self.initializeCustomRows();

        }

        MacroTastic.prototype.parseMacroValue = function(macroJQuerySelector) {
            let self = this;
            let currentMacroElement = self.$(macroJQuerySelector);
            let currentMacroText = currentMacroElement.text();
            let currentMacroValue = parseFloat(currentMacroText.replace(/\s+g/gi, ''))
            return currentMacroValue;
        };

        MacroTastic.prototype.getRemainingMacros = function(maxValues) {
            let self = this;
            let fatSelector = '#dailyTotals > div > div:nth-child(3) > div > div.amount';
            let carbsSelector = '#dailyTotals > div.content.firstBlock > div:nth-child(5) > div > div.amount';
            let fiberSelector = '#dailyTotals > div.content.firstBlock > div:nth-child(4) > div > div.amount';
            let proteinSelector = '#dailyTotals > div.content.firstBlock > div:nth-child(7) > div > div.amount';

            self.currentValues.fat = self.parseMacroValue(fatSelector);
            self.currentValues.carbs = self.parseMacroValue(carbsSelector);
            self.currentValues.fiber = self.parseMacroValue(fiberSelector);
            self.currentValues.protein = self.parseMacroValue(proteinSelector);
            self.currentValues.total = Math.round(self.currentValues.fat * 9 + (self.currentValues.carbs - self.currentValues.fiber) * 4 + self.currentValues.protein * 4);

            return {
                'fat': self.maxValues.fat - self.currentValues.fat,
                'carbs': self.maxValues.carbs - (self.currentValues.carbs + self.currentValues.fiber),
                'protein': self.maxValues.protein - self.currentValues.protein,
            };
        };

        MacroTastic.prototype.createRowContainer = function() {
            // Create all the rows
            let self = this;
            let customRowsSelector = 'div#my-custom-rows';
            if (self.$(customRowsSelector).length === 0 || self.$(customRowsSelector).is(":hidden")) {
                self.$('div#dailyTotals').append('<div id="my-custom-rows"></div>');
            }
        };

        MacroTastic.prototype.createRow = function(rowElementId, rowInitializerCallback) {
            let self = this;
            self.createRowContainer();

            let customRowsElement = self.$('div#my-custom-rows');
            let selector = 'div#' + rowElementId;
            if (self.$(selector).length === 0) {
                customRowsElement.append('<div id=' + rowElementId + ' class="content"></div>');
                let resultElement = self.$(selector);
                rowInitializerCallback(resultElement);
            }
        };

        MacroTastic.prototype.createColumn = function(substanceLabel, substanceAmount, substanceUnit, calorieAmount, totalAmount) {
            const percentage = Math.round((calorieAmount/totalAmount) * 100);
            let htmlValue = `
    <div class="total">
      <div class="label">
        <div class="substance">${substanceLabel} (${percentage}%)</div>
        <div class="amount">
          ${substanceAmount} <span class="unit"> ${substanceUnit}</span>
        </div>
       </div>
    </div>
    `;
            return self.$(htmlValue);
        };

        MacroTastic.prototype.initializeCustomRows = function() {
            this.createRow('adjusted-totals', rowElement => {
                rowElement.append(this.$('<h3>Adjusted Macros</h3>'));
                rowElement.append(this.createColumn('Calories', this.currentValues.total, 'kCal', this.currentValues.total, this.maxValues.dailyCalories));
                rowElement.append(this.createColumn('Fat', this.currentValues.fat, 'g', this.currentValues.fat * 9, this.currentValues.total));
                rowElement.append(this.createColumn('Carbs', (this.currentValues.carbs - this.currentValues.fiber), 'g', (this.currentValues.carbs - this.currentValues.fiber) * 4, this.currentValues.total));
                rowElement.append(this.createColumn('Protein', this.currentValues.protein, 'g', this.currentValues.protein * 4, this.currentValues.total));
            });

            this.createRow('my-max', rowElement => {
                rowElement.append(this.$('<h3>Max Macros</h3>'));
                rowElement.append(this.createColumn('Fat', this.maxValues.fat, 'g', this.maxValues.fat * 9, this.maxValues.dailyCalories));
                rowElement.append(this.createColumn('Net Carbs', this.maxValues.carbs, 'g', this.maxValues.carbs * 4, this.maxValues.dailyCalories));
                rowElement.append(this.createColumn('Protein', this.maxValues.protein, 'g', this.maxValues.protein * 4, this.maxValues.dailyCalories));
            });

            this.createRow('my-remainders', rowElement => {
                const remainingMacros = this.getRemainingMacros(this.maxValues);
                rowElement.append(this.$('<h3>Remaining Macros</h3>'));
                rowElement.append(this.createColumn('Fat', remainingMacros.fat, 'g', remainingMacros.fat * 9, this.maxValues.dailyCalories));
                rowElement.append(this.createColumn('Net Carbs', remainingMacros.carbs, 'g', remainingMacros.carbs * 4, this.maxValues.dailyCalories));
                rowElement.append(this.createColumn('Protein', remainingMacros.protein, 'g', remainingMacros.protein * 4, this.maxValues.dailyCalories));
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
        fat: 76,
        carbs: 329,
        protein: 175,
        // 1g fat = 9 Calories,
        // 1g Carbs or Protein = 4 calories.
        dailyCalories: 2700,
    });
})(jQuery);
