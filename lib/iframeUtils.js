// --- lib/iframeUtils.js ---

/**
 * Processes items identified as iframes and appends them to the DOM.
 * Each item represents a single iframe defined by '## title'.
 * Required properties per item: src, div.
 * Optional properties: width, height, frameborder, title, loading, allowfullscreen, etc.
 *
 * @param {Array<Object>} iframeItems - Array of items with kind === 'iframes'.
 */
function processIframes(iframeItems) {
  console.info(
    `HANDLER: processIframes called with ${iframeItems.length} item(s)`,
  );
  if (!iframeItems || iframeItems.length === 0) {
    console.warn("No iframe items found to process.");
    return;
  }

  iframeItems.forEach((item, index) => {
    console.info(`Processing iframe item ${index + 1}:`, item);

    // Validate required properties
    if (!item.src) {
      console.warn(
        `Skipping iframe item (title: ${
          item.title || "N/A"
        }): missing 'src' property.`,
      );
      return; // Skip this item
    }
    let wrapper;
    if (!item.div) {
      wrapper = document.createElement("DIV");
      if (item.overlay) {
        const overlay = document.createElement("DIV");
        overlay.classList.add("iframe-overlay");
        wrapper.appendChild(overlay);
        if (item["overlay-style"]) {
          overlay.style = item["overlay-style"];
          delete item["overlay-style"];
        }
        overlay.style.width = item.width ?? 0;
        overlay.style.height = item.height ?? 0;
      }
      if (item["wrapper-style"]) {
        wrapper.style = item["wrapper-style"];
      }
      if (item["wrapper-id"]) {
        wrapper.id = item["wrapper-id"];
      }
      wrapper.style.zIndex = 100000; // Start high enough to pass post its
      wrapper.classList.add("iframe-wrapper");
      wrapper.addEventListener("mouseover", () => toTop(wrapper));
      if (item.hidden) {
        item.loading = "lazy";
        wrapper.style.display = "none";
        window._ntCommands = window._ntCommands || [];
        window._ntCommands = window._ntCommands.concat([
          {
            title: item.command || "show iframe",
            lambda: () => {
              if (wrapper.style.display == "none") {
                wrapper.style.display = "block";
              } else {
                wrapper.style.display = "none";
              }
            },
          },
        ]);
      }
      if (item.left) {
        wrapper.style.left = item.left;
      }
      if (item.right) {
        wrapper.style.right = item.right;
      }
      if (item.top) {
        wrapper.style.top = item.top;
      }
      if (item.bottom) {
        wrapper.style.bottom = item.bottom;
      }
      document.body.appendChild(wrapper);
      interact(wrapper).draggable({
        // TODO: dragging behaves badly
        inertia: true,
        autoScroll: true,
        listeners: {
          start(event) {
            const iframe = event.target.querySelector("iframe");
            if (iframe) {
              const placeholder = document.createElement("div");
              placeholder.id = "iframe-placeholder";
              placeholder.className = "iframe-placeholder";
              placeholder.style.width = iframe.width;
              placeholder.style.height = iframe.height;
              iframe.classList.add("iframe-hidden");
              event.target.appendChild(placeholder);
            }
          },
          move(event) {
            var target = event.target;
            var x = Math.floor(
              (parseFloat(target.getAttribute("data-x")) || 0) + event.dx,
            );
            var y = Math.floor(
              (parseFloat(target.getAttribute("data-y")) || 0) + event.dy,
            );

            target.style.transform = `translate(${x}px, ${y}px)`;

            target.setAttribute("data-x", x);
            target.setAttribute("data-y", y);
          },
          end(event) {
            const iframe = event.target.querySelector("iframe");
            const placeholder = event.target.querySelector(
              "#iframe-placeholder",
            );
            if (iframe && placeholder) {
              iframe.classList.remove("iframe-hidden");
              event.target.removeChild(placeholder);
            }
          },
        },
      });
    }

    // Find target DOM element
    const targetElement = document.getElementById(item.div) || wrapper;

    // Create the iframe element
    const iframe = document.createElement("iframe");

    // --- Set Attributes ---
    // Required
    iframe.src = item.src;

    // Optional with defaults or based on item properties
    iframe.title = item.title || `iframe-${index}`; // Use parsed title or generate one
    iframe.id = item.id || `iframe-${index}`;
    iframe.width = item.width || "100%"; // Default width if not specified
    iframe.height = item.height || "400"; // Default height if not specified
    iframe.frameborder = item.frameborder || "0"; // Default frameborder
    iframe.loading = item.loading || "lazy"; // Default loading strategy

    // Add other common boolean attributes if present and 'true' (or just present)
    if (
      item.allowfullscreen &&
      item.allowfullscreen.toLowerCase() !== "false"
    ) {
      iframe.allowFullscreen = true;
    }
    if (item.allow) {
      // For permissions policy
      iframe.setAttribute("allow", item.allow);
    }
    if (item.sandbox) {
      // For security sandboxing
      iframe.setAttribute("sandbox", item.sandbox);
    }
    // Add any other custom attributes defined in the item's properties
    // Filter out known/handled properties and kind/title/div
    const handledProps = [
      "kind",
      "title",
      "div",
      "src",
      "width",
      "height",
      "frameborder",
      "loading",
      "allowfullscreen",
      "allow",
      "sandbox",
    ];
    for (const key in item) {
      if (
        Object.hasOwnProperty.call(item, key) &&
        !handledProps.includes(key.toLowerCase())
      ) {
        try {
          iframe.setAttribute(key, item[key]);
          console.info(
            `Applied custom attribute '${key}=${item[key]}' to iframe ${iframe.title}`,
          );
        } catch (e) {
          console.warn(
            `Could not apply custom attribute '${key}=${item[key]}' to iframe ${iframe.title}`,
          );
        }
      }
    }

    // --- Append to Target ---
    console.info(`Appending iframe (src: ${item.src}) to target #${item.div}`);
    // Consider clearing target first? Depends on desired behavior.
    // targetElement.innerHTML = ''; // Uncomment to replace existing content
    targetElement.appendChild(iframe);
  });
}
