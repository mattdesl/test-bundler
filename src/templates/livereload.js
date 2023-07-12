const errPopupId = Symbol.for("canvas-sketch-cli/error");
const cssPopupId = Symbol.for("canvas-sketch-cli/css");
const apiId = Symbol.for("canvas-sketch-cli");

const css = `
.error-container {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(255,255,255,0.85);
}
.error-box {
  padding: 20px;
  font: 14px monospace;
  box-sizing: border-box;
  border-radius: 4px;
}
.error-text pre {
  color: #e31919;
  white-space: pre-wrap;
}
.error-title {
  font-size: 16px;
  font-weight: bold;
  margin-bottom: 5px;
}
.error-note {
  color: forestgreen;
}
.error-loc {
  font-size: 12px;
  font-style: italic;
  color: hsl(0%, 0%, 50%);
}`;

const errorToHTML = (error) => {
  let html = error.message;
  if (error.errors) {
    const errorDivs = error.errors
      .map((err) => {
        const notes = err.notes
          ? err.notes
              .map(
                (note) =>
                  `<div class='error-note'><pre>${note.text}</pre></div>`
              )
              .join("\n")
          : "";
        const errMsg = [
          err.location.line > 1 ? "..." : "",
          err.location.lineText,
          Array(err.location.column).fill(" ").join("") + "^",
        ]
          .filter(Boolean)
          .join("\n");
        return `<div class='error-box'>
        <div class='error-title'>${err.text}</div>
        <div class='error-loc'>${err.location.file} on line ${err.location.line} column ${err.location.column}</div>
        <div class='error-text'>
          <pre>${errMsg}</pre>
        </div>
        ${notes}
      </div>`;
      })
      .join("\n");
    html = `<div class='error-container'>${errorDivs}</div>`;
  } else {
    html = `<div class='error-container'>
    <div class='error-box'>
      <div class='error-text'>
        <pre>${html}</pre>
      </div>
    </div>
</div>`;
  }
  return html;
};

const clearPopup = () => {
  const el = window[errPopupId];
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
  window[errPopupId] = null;
};

window[apiId] = window[apiId] || {
  listeners: [],
};

window[apiId].showError = (error) => {
  if (!window[cssPopupId]) {
    window[cssPopupId] = true;
    const sheet = document.createElement("style");
    sheet.innerHTML = css;
    document.body.appendChild(sheet);
  }
  clearPopup();
  const err = document.createElement("div");
  err.classList.add("canvas-sketch-cli-error-popup");
  err.innerHTML = errorToHTML(error);
  document.body.appendChild(err);
};

window.onload = () => {
  let socket;
  retry();
  function retry() {
    // console.log('[canvas-sketch-cli-client] init')
    socket = new WebSocket(
      `ws://${window.location.host}/canvas-sketch-cli/livereload`
    );
    socket.onopen = () => {
      // console.log("[canvas-sketch-cli-client] connected");
    };
    socket.onmessage = (m) => {
      let evt;
      try {
        evt = JSON.parse(m.data);
      } catch (err) {
        return console.error(err);
      }
      if (evt.event === "reload") {
        console.log("reload script", evt);
        // window[apiId].listeners.forEach((fn) => fn(evt));
        location.reload();
      }
    };
    socket.onclose = () => {
      // console.log("[canvas-sketch-cli-client] disconnected");
      setTimeout(retry, 1000);
    };
    return socket;
  }
};
