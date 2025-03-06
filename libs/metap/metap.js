class MetaP {
  constructor() {
    this.metaPGlass = document.createElement("DIV");
    this.metaPGlass.id = "metap-glass";
    this.metaPModal = document.createElement("DIV");
    this.metaPModal.id = "metap-modal";
    this.searchText = "";
    this.oldp = window.print;
    this.selectedCommand = null;
    this.inputBuffer = "";
    this.focusedElementBeforeOpen = null;
    this.commandInputValues = new Map();
    this.maxInitialCommands = 7;
    this.ellipsisRow = null;
    this.maxCommandTitleLength = 20; // NEW: Maximum length for command titles

    this.searchInputDisplay = document.createElement("DIV");
    this.searchInputDisplay.id = "metap-search-input";
    this.searchInputDisplay.classList.add("metap-inputs");
    this.metaPGlass.appendChild(this.metaPModal);
    this.metaPModal.appendChild(this.searchInputDisplay);

    this.formInputDisplay = document.createElement("DIV");
    this.formInputDisplay.id = "metap-form-input";
    this.formInputDisplay.classList.add("metap-inputs");
    this.metaPModal.appendChild(this.formInputDisplay);

    Array.from(this.metaPModal.querySelectorAll(".metap-inputs")).map(
      (inp) => (inp.style.display = "none"),
    );
    this.commandListContainer = document.createElement("DIV");
    this.commandListContainer.id = "metap-command-list";
    this.metaPModal.appendChild(this.commandListContainer);
  }

  bind(commands, filters = {}) {
    window.print = null;
    document.body.appendChild(this.metaPGlass);
    this.blur = filters.blur ?? 3;
    this.sepia = filters.sepia ?? 0;
    this.commands = commands;
    const isMac =
      /Mac|iPod|iPhone|iPad/.test(navigator.platform) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    document.addEventListener("keydown", (ev) => {
      const cmd = isMac ? ev.metaKey : ev.ctrlKey;
      if (ev.key === "p" && cmd) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        this.metaP();
        return;
      }
    });
    document.addEventListener("keyup", (ev) => {
      const cmd = isMac ? ev.metaKey : ev.ctrlKey;
      if (ev.key === "p" && cmd) {
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        this.metaP();
        return;
      }
      this.handler(ev);
    });
  }

  toggle() {
    if (this.metaPModal.style.display === "block") {
      this.metaPModal.style.display = "none";
      this.metaPGlass.style.display = "none";
      this.metaPGlass.style.backdropFilter = null;
      Array.from(this.metaPModal.querySelectorAll(".metap-inputs")).map(
        (inp) => (inp.style.display = "none"),
      );
      if (this.focusedElementBeforeOpen) {
        this.focusedElementBeforeOpen.focus();
        this.focusedElementBeforeOpen = null;
      }
    } else {
      this.metaPModal.style.display = "block";
      this.metaPGlass.style.display = "block";
      this.metaPGlass.style.backdropFilter = `blur(${this.blur}px) sepia(${this.sepia}%)`;
      this.updateDisplay();
      this.focusedElementBeforeOpen = document.activeElement;
    }
    this.resetState();
  }

  metaP() {
    this.commandListContainer.innerHTML = "";
    const initialCommands = this.searchText
      ? this.commands
      : this.commands.slice(0, this.maxInitialCommands);
    initialCommands.forEach((d, index) => {
      const div = document.createElement("DIV");
      let commandTitle = d.title;
      if (d.title.split("\n").length > 1) {
        commandTitle = d.aliases ? d.aliases[0] : "[Multiline command]";
      }
      if (commandTitle.length > this.maxCommandTitleLength) {
        commandTitle =
          commandTitle.substring(0, this.maxCommandTitleLength) + "…";
      }
      div.innerText = commandTitle;
      div.title = d.title;

      div.classList.add("metap-modal-row");
      div.style.display = "block";

      div.lambda = d.lambda;
      div.updater = d.updater;
      div.inputs = d.inputs;
      div.command = d;
      div.aliases = d.aliases;

      div.addEventListener("click", () => {
        this.selectCommand(d, div);
      });
      div.dataset.index = index;
      this.commandListContainer.appendChild(div);
    });

    if (!this.searchText && this.commands.length > this.maxInitialCommands) {
      this.ellipsisRow = document.createElement("DIV");
      this.ellipsisRow.innerText = "...";
      this.ellipsisRow.classList.add("metap-modal-row", "metap-ellipsis-row");
      this.ellipsisRow.style.display = "block";
      this.commandListContainer.appendChild(this.ellipsisRow);
    } else if (this.ellipsisRow) {
      this.commandListContainer.removeChild(this.ellipsisRow);
      this.ellipsisRow = null;
    }

    this.updateDisplay();
    this.toggle();
  }

  selectCommand(command, div) {
    if (command.inputs && Array.isArray(command.inputs)) {
      this.selectedCommand = command;
      this.formInputDisplay.innerHTML = "";

      const form = document.createElement("FORM");
      form.id = "metap-input-form";
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        this.handleFormSubmit(form, command);
      });

      const savedValues = this.commandInputValues.get(command);

      command.inputs.forEach((inputDef, index) => {
        const input = document.createElement("INPUT");
        input.type = "text";
        input.classList.add("metap-form-input");
        input.dataset.index = index;
        input.placeholder = inputDef.title;

        if (inputDef.default) {
          input.value = inputDef.default;
        } else if (savedValues && savedValues[index]) {
          input.value = savedValues[index];
        }

        input.addEventListener("keyup", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            const nextIndex = index + 1;
            if (nextIndex < command.inputs.length) {
              const nextInput = form.querySelector(
                `input[data-index="${nextIndex}"]`,
              );
              if (nextInput) {
                nextInput.focus();
              }
            } else {
              form.dispatchEvent(new Event("submit"));
            }
          } else {
            if (command.updater) {
              const inputValues = Array.from(
                form.querySelectorAll(".metap-form-input"),
              ).map((input) => input.value);
              this.commandInputValues.set(command, inputValues);
              div.textContent = command.updater(...inputValues);
            }
          }
        });
        form.appendChild(input);
        if (index === 0) {
          setTimeout(() => input.focus(), 0);
        }
      });

      this.formInputDisplay.appendChild(form);
      this.formInputDisplay.style.display = "block";
      Array.from(this.metaPModal.querySelectorAll(".metap-inputs"))
        .filter((inp) => inp !== this.formInputDisplay)
        .forEach((inp) => (inp.style.display = "none"));
    } else {
      command.lambda();
      this.toggle();
    }
    this.updateDisplay();
  }

  handleFormSubmit(form, command) {
    const inputValues = Array.from(
      form.querySelectorAll(".metap-form-input"),
    ).map((input) => input.value);
    this.commandInputValues.set(command, inputValues);
    command.lambda(...inputValues);
    this.toggle();
  }

  resetState() {
    this.selectedCommand = null;
    this.inputBuffer = "";
    this.searchText = "";

    this.formInputDisplay.innerHTML = "";
    this.formInputDisplay.style.display = "none";

    Array.from(this.metaPModal.querySelectorAll(".metap-inputs")).map(
      (inp) => (inp.style.display = "none"),
    );
    this.updateDisplay();
  }

  updateDisplay() {
    this.searchInputDisplay.innerText = this.searchText;
    if (this.searchText) {
      this.searchInputDisplay.style.display = "block";
    } else {
      this.searchInputDisplay.style.display = "none";
    }

    const ps = Array.from(this.commandListContainer.querySelectorAll("DIV"));
    const allCommands = Array.from(
      this.commandListContainer.querySelectorAll("DIV"),
    );

    const matches = ps.filter((p) => {
      const titleMatch = p.textContent
        .toLowerCase()
        .includes(this.searchText.toLowerCase());
      let aliasMatch = false;
      if (p.aliases && Array.isArray(p.aliases)) {
        aliasMatch = p.aliases.some((alias) =>
          alias.toLowerCase().includes(this.searchText.toLowerCase()),
        );
      }
      return titleMatch || aliasMatch;
    });

    if (matches.length === 1) {
      console.log(matches);
      matches[0].textContent = matches[0].command.title;
    } else {
      for (let match of ps) {
        if (match.textContent.length > this.maxCommandTitleLength) {
          match.textContent =
            match.textContent.substring(0, this.maxCommandTitleLength) + "…";
        }
      }
    }

    if (!this.searchText) {
      allCommands.forEach((p, index) => {
        p.style.display = index < this.maxInitialCommands ? "block" : "none";
      });
      if (this.ellipsisRow) this.ellipsisRow.style.display = "block";
    } else {
      allCommands.forEach((p) => (p.style.display = "none"));
      matches.forEach((p) => (p.style.display = "block"));
      if (this.ellipsisRow) this.ellipsisRow.style.display = "none";
    }
  }

  handler(ev) {
    if (this.metaPModal.style.display === "block") {
      console.log(ev);
      if (ev.target.nodeName === "INPUT" && ev.key !== "Escape") {
        return;
      }
      ev.preventDefault();
      ev.stopPropagation();

      if (ev.key === "Backspace") {
        this.searchText = this.searchText.slice(0, -1);
      } else if (ev.key === "Escape") {
        if (this.searchText != "") {
          this.searchText = "";
        } else {
          this.toggle();
          return;
        }
      } else if (ev.key === "Enter") {
        const ps = Array.from(
          this.commandListContainer.querySelectorAll("DIV"),
        );
        const vizP = ps.filter((p) => p.style.display === "block");
        if (vizP.length === 0) {
          this.toggle();
          return;
        }
        const commandIndex = parseInt(vizP[0].dataset.index);
        const command = this.commands[commandIndex];
        this.selectCommand(command, vizP[0]);
        return;
      } else if (ev.key.length === 1) {
        this.searchText += ev.key;
      }

      this.updateDisplay();
    }
  }
}

const metaP = new MetaP();

if (typeof module !== "undefined" && module.exports) {
  module.exports = { metaP };
} else if (typeof define === "function" && define.amd) {
  define(function () {
    return metaP;
  });
} else {
  window.metaP = metaP;
}
