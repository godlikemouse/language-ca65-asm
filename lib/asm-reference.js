const packageConfig = require('./config-schema.json');
const cpuData = require('./cpu-data.json');

module.exports = {

    currentTooltip: null,
    currentNode: null,
    orphanedTooltipsCallback: null,

    config: packageConfig,

    activate(state) {
        this.initMouseListeners();
    },

    deactivate() {
        this.removeMouseListeners();
    },

    initMouseListeners() {
        document.body.addEventListener('mouseover', this.mouseMoveCallback.bind(this));
        this.orphanedTooltipsCallback = setInterval(this.removeOrphanedTooltips.bind(this), 1000);
    },

    removeMouseListeners() {
        document.body.removeEventListener('mouseover', this.mouseMoveCallback.bind(this));
        clearInterval(this.orphanedTooltipsCallback);
    },

    toHexadecimal(s, radix) {
      var n = parseInt(s, radix);
      if (n > 255)
        return Number(n).toString(16).padStart(4, '0').toUpperCase();
      else
        return Number(n).toString(16).padStart(2, '0').toUpperCase();
    },

    toBinary(s, radix) {
      var n = parseInt(s, radix);
      if (n > 255)
        return Number(n).toString(2).padStart(16, '0');
      else
        return Number(n).toString(2).padStart(8, '0');
    },

    mouseMoveCallback(e) {
        const functionNameNode = e.target;
        const name = functionNameNode.innerHTML.trim();
        const context = this;

        // Check if we're already displaying the definition of this node
        if (!functionNameNode || this.currentNode == functionNameNode) {
            return;
        }

        this.currentNode = functionNameNode;
        this.removeCurrentTooltip();

        if(atom.config.get("language-ca65-asm.enableNumberTooltips") === true) {
            // Number format conversion
            if (e.target.matches('.syntax--constant.syntax--numeric.syntax--integer.syntax--binary.syntax--asm')) {
              var conv = "Decimal: "      + parseInt(name.replace("%",""), 2) + ", "
                       + "Hexadecimal: $" + this.toHexadecimal(name.replace("%",""), 2);
              context.currentTooltip = atom.tooltips.add(functionNameNode, { title: conv, trigger: 'manual', delay: 0 });
              return;
            } else if (e.target.matches('.syntax--constant.syntax--numeric.syntax--integer.syntax--hexadecimal.syntax--asm')) {
              var conv = "Decimal: " + parseInt(name.replace("$",""), 16) + ", "
                       + "Binary: %" + this.toBinary(name.replace("$",""), 16);
              context.currentTooltip = atom.tooltips.add(functionNameNode, { title: conv, trigger: 'manual', delay: 0 });
              return;
            } else if (e.target.matches('.syntax--constant.syntax--numeric.syntax--integer.syntax--decimal.syntax--asm')) {
              var conv = "Hexadecimal: $" + this.toHexadecimal(name, 10) + ", "
                       + "Binary: %"      + this.toBinary(name, 10);
              context.currentTooltip = atom.tooltips.add(functionNameNode, { title: conv, trigger: 'manual', delay: 0 });
              return;
            }
        }

        if(atom.config.get("language-ca65-asm.enableInstructionsTooltips") !== true) {
            return;
        }
        // Only run for ASM opcodes
        if (!e.target.matches('.syntax--keyword.syntax--control.syntax--statement.syntax--asm') &&
            !e.target.matches('.syntax--keyword.syntax--control.syntax--statement.syntax--asmc02') &&
            !e.target.matches('.syntax--keyword.syntax--control.syntax--statement.syntax--asm816')) {
            return;
        }

        content = this.getAsmDefinition(name);
        if (typeof content != 'undefined' && content && content != 'NONE') {
            context.currentTooltip = atom.tooltips.add(functionNameNode, { title: content, trigger: 'manual', delay: 0 });
        };
    },

    removeOrphanedTooltips() {
        for (const node of document.querySelectorAll('.asm_hover-definition')) {
            if (typeof this.currentNode == 'undefined' || !this.currentNode || node.getAttribute('function-name') != this.currentNode.textContent.trim()) {
                node.closest('.tooltip').remove();
            }
        }
    },

    removeCurrentTooltip() {
        if (this.currentTooltip) {
            this.currentTooltip.dispose();
            this.currentTooltip = null;
        }
    },

    getAsmDefinition(name) {
        var cpu       = atom.config.get("language-ca65-asm.cpuType");
        var operation = cpuData[cpu].operations[name.toUpperCase()];
        var opcodes   = cpuData[cpu].opcodes.filter(o => o.mnemo == name.toUpperCase());
        if (operation !== undefined) {
            var doc       = undefined;
            if (operation.documentation !== undefined)
                doc = operation.documentation;
            else {
                /* Fallback */
                op6502 = cpuData["6502"].operations[name.toUpperCase()];
                if (op6502 !== undefined) {
                    doc = op6502.documentation;
                }
            }
            const content = `
                <div class="asm_hover-definition" function-name="${name}">
                  <div class="title">
                    <div class="operation">
                      ${name.toUpperCase()}
                    </div>
                    <div class="short_description">
                      ${doc !== undefined ? doc.title:""} (${operation.description})
                    </div>
                  </div>
                  <p class="description">
                    ${doc !== undefined ? doc.text:""}
                  </p>
                  <div class="affected_flags">Affected flags:<br/>&nbsp;</div>
                  <div class="flags_list">
                    ${cpuData[cpu].flags.names}<br/>
                    ${operation.flags.replace(/[A-Z]/g,'^').replace(/-/g, '&nbsp;')}
                  </div>
                  <div class="addressing_mode_section">Addressing modes:</div>
                  <div class="info">
                    <div class="addressing_modes">
                      ${this.getAddressingModesLabel(cpu, opcodes)}
                    </div>
                  </div>
                </div>
            `;
            return content;
        } else {
            return undefined;
        }
    },

    getAddressingModesLabel(cpu, opcodes) {
      var addressing = "";

      for(mode of opcodes) {
        var addmode    = cpuData[cpu].addmodes[mode.addmode];
        var extra_cost = "";

        if (mode.cyclesymbols.indexOf("p") > -1) {
          if (extra_cost != "") {
            extra_cost += ",<br/>";
          }
          extra_cost += "p: +1 if page crossed";
        }
        if (mode.cyclesymbols.indexOf("d") > -1) {
          if (extra_cost != "") {
            extra_cost += ",<br/>";
          }
          extra_cost += "d: +1 if decimal mode";
        }
        if (mode.cyclesymbols.indexOf("t") > -1) {
          if (extra_cost != "") {
            extra_cost += ",<br/>";
          }
          extra_cost += "t: +1 if branch taken";
        }

        addressing += `
            <div class="addressing_type">
              ${addmode.description}
            </div>
            <div class="addressing_syntax">
              ${addmode.syntax}
            </div>
            <div class="size">
              ${addmode.bytes} bytes
            </div>
            <div class="cost">
              ${mode.cycles} cycles
            </div>
            <div class="extra_cost">
               ${extra_cost}
            </div>
        `;
      }
      return addressing;
    }
};
