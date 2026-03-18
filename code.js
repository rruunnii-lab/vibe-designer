// Vibe Designer - Figma Plugin (sandbox code)
// ES5-compatible syntax for Figma's plugin sandbox.

try {
  figma.showUI(__html__, { width: 520, height: 640, themeColors: true });
  figma.ui.resize(520, 640);
} catch (e) {
  figma.notify("Failed to load UI: " + e.message, { error: true });
}

function extractInstance(node) {
  var abs = node.absoluteTransform;
  var props = {};
  try {
    var cp = node.componentProperties;
    var keys = Object.keys(cp);
    for (var i = 0; i < keys.length; i++) {
      props[keys[i]] = {
        type: cp[keys[i]].type,
        value: cp[keys[i]].value
      };
    }
  } catch (e) { /* no properties */ }
  var mainComp = null;
  try {
    var mc = node.mainComponent;
    if (mc) {
      mainComp = { id: mc.id, name: mc.name };
      if (mc.parent && mc.parent.type === "COMPONENT_SET") {
        mainComp.componentSetId = mc.parent.id;
        mainComp.componentSetName = mc.parent.name;
      }
    }
  } catch (e) { /* no main component */ }
  return {
    type: "INSTANCE",
    id: node.id,
    name: node.name,
    mainComponent: mainComp,
    componentProperties: props,
    x: abs ? abs[0][2] : node.x,
    y: abs ? abs[1][2] : node.y,
    width: node.width,
    height: node.height
  };
}

function extractAll(node) {
  var results = { components: [], textNodes: [], instances: [] };

  if (node.type === "COMPONENT_SET") {
    results.components.push(extractComponentSet(node));
  } else if (node.type === "COMPONENT") {
    results.components.push(extractSingleComponent(node));
  } else if (node.type === "INSTANCE") {
    results.instances.push(extractInstance(node));
  }

  // Collect text nodes (direct or nested)
  if (node.type === "TEXT") {
    results.textNodes.push(extractTextNode(node));
  }

  if ("children" in node) {
    // Find component sets
    if (node.type !== "COMPONENT_SET" && node.type !== "COMPONENT") {
      var sets = node.findAllWithCriteria({ types: ["COMPONENT_SET"] });
      for (var i = 0; i < sets.length; i++) {
        results.components.push(extractComponentSet(sets[i]));
      }
      if (sets.length === 0) {
        var comps = node.findAllWithCriteria({ types: ["COMPONENT"] });
        for (var j = 0; j < comps.length; j++) {
          results.components.push(extractSingleComponent(comps[j]));
        }
      }
    }

    // Find all instances
    if (node.type !== "INSTANCE") {
      var instances = node.findAll(function (n) { return n.type === "INSTANCE"; });
      for (var m = 0; m < instances.length; m++) {
        results.instances.push(extractInstance(instances[m]));
      }
    }

    // Find all text nodes
    var texts = node.findAllWithCriteria({ types: ["TEXT"] });
    for (var k = 0; k < texts.length; k++) {
      results.textNodes.push(extractTextNode(texts[k]));
    }
  }

  return results;
}

function extractTextNode(node) {
  var abs = node.absoluteTransform;
  return {
    type: "TEXT",
    id: node.id,
    name: node.name,
    characters: node.characters,
    fontName: node.fontName,
    x: abs ? abs[0][2] : node.x,
    y: abs ? abs[1][2] : node.y,
    width: node.width,
    height: node.height
  };
}

function extractComponentSet(node) {
  var propertyDefs = node.componentPropertyDefinitions;
  var variants = node.children.map(function (child) {
    return { id: child.id, name: child.name };
  });

  var properties = {};
  var entries = Object.entries(propertyDefs);
  for (var i = 0; i < entries.length; i++) {
    var key = entries[i][0];
    var def = entries[i][1];
    properties[key] = {
      type: def.type,
      defaultValue: def.defaultValue,
      variantOptions: def.variantOptions || []
    };
  }

  var abs = node.absoluteTransform;
  return {
    type: "COMPONENT_SET",
    id: node.id,
    name: node.name,
    properties: properties,
    variants: variants,
    x: abs ? abs[0][2] : node.x,
    y: abs ? abs[1][2] : node.y,
    width: node.width,
    height: node.height
  };
}

function extractSingleComponent(node) {
  var abs = node.absoluteTransform;
  return {
    type: "COMPONENT",
    id: node.id,
    name: node.name,
    x: abs ? abs[0][2] : node.x,
    y: abs ? abs[1][2] : node.y,
    width: node.width,
    height: node.height
  };
}

function deepScanInstances(node, path, depth, results) {
  if (!path) path = [];
  if (typeof depth !== "number") depth = 0;
  if (!results) results = [];

  if (node.type === "INSTANCE") {
    var item = {
      id: node.id,
      name: node.name,
      path: path.slice(),
      depth: depth,
      properties: {}
    };

    try {
      var cp = node.componentProperties;
      var keys = Object.keys(cp);
      for (var i = 0; i < keys.length; i++) {
        var prop = cp[keys[i]];
        if (prop.type === "VARIANT" || prop.type === "BOOLEAN") {
          item.properties[keys[i]] = {
            type: prop.type,
            value: prop.type === "BOOLEAN" ? !!prop.value : prop.value,
            options: prop.type === "BOOLEAN" ? [true, false] : []
          };
        }
      }
    } catch (e) { /* no properties */ }

    try {
      var mc = node.mainComponent;
      if (mc && mc.parent && mc.parent.type === "COMPONENT_SET") {
        var propDefs = mc.parent.componentPropertyDefinitions;
        var propKeys = Object.keys(item.properties);
        for (var p = 0; p < propKeys.length; p++) {
          var pKey = propKeys[p];
          if (propDefs[pKey] && propDefs[pKey].variantOptions && propDefs[pKey].variantOptions.length > 0) {
            item.properties[pKey].options = propDefs[pKey].variantOptions;
          }
        }
      }
    } catch (e) { /* no component set */ }

    var propKeys2 = Object.keys(item.properties);
    var hasMultiOption = false;
    for (var h = 0; h < propKeys2.length; h++) {
      if (item.properties[propKeys2[h]].options.length > 1) {
        hasMultiOption = true;
        break;
      }
    }
    if (hasMultiOption) {
      results.push(item);
    }
  }

  if ("children" in node) {
    for (var c = 0; c < node.children.length; c++) {
      var childPath = path.slice();
      childPath.push(c);
      deepScanInstances(node.children[c], childPath, depth + 1, results);
    }
  }

  return results;
}

function navigateToPath(root, path) {
  var current = root;
  for (var i = 0; i < path.length; i++) {
    if (!current || !("children" in current)) return null;
    if (path[i] >= current.children.length) return null;
    current = current.children[path[i]];
  }
  return current;
}

function collectInstancePaths(node, path, depth, results) {
  if (!path) path = [];
  if (typeof depth !== "number") depth = 0;
  if (!results) results = [];

  if (node.type === "INSTANCE") {
    var item = {
      path: path.slice(),
      depth: depth,
      properties: null,
      skipped: false,
      name: node.name,
      nodeId: node.id
    };

    try {
      var mc = node.mainComponent;
      if (!mc) {
        item.skipped = true;
      }
    } catch (e) {
      item.skipped = true;
    }

    if (!item.skipped) {
      try {
        var cp = node.componentProperties;
        var keys = Object.keys(cp);
        var props = {};
        for (var i = 0; i < keys.length; i++) {
          props[keys[i]] = cp[keys[i]].value;
        }
        item.properties = props;
      } catch (e) {
        item.properties = {};
      }
    }

    results.push(item);
  }

  if ("children" in node) {
    for (var c = 0; c < node.children.length; c++) {
      var childPath = path.slice();
      childPath.push(c);
      collectInstancePaths(node.children[c], childPath, depth + 1, results);
    }
  }

  return results;
}

// --- Thumbnail helpers ---

function withTimeout(promise, ms) {
  return new Promise(function(resolve, reject) {
    var timer = setTimeout(function() { reject(new Error("timeout")); }, ms);
    promise.then(function(val) { clearTimeout(timer); resolve(val); })
           .catch(function(err) { clearTimeout(timer); reject(err); });
  });
}

function extractNodeIds(operations, maxNodes) {
  var seen = {};
  var ids = [];
  for (var i = 0; i < operations.length; i++) {
    var op = operations[i];
    if (op.type === "duplicate" || (op.type && op.type.indexOf("create_") === 0)) continue;
    var targetId = (op.type === "property") ? op.componentSetId : op.id;
    if (targetId && !seen[targetId]) {
      seen[targetId] = true;
      ids.push(targetId);
    }
    if (ids.length >= maxNodes) break;
  }
  return ids;
}

function captureNodeThumbnails(nodeIds) {
  var promises = [];
  for (var i = 0; i < nodeIds.length; i++) {
    (function(id) {
      var node = figma.getNodeById(id);
      if (node) {
        promises.push(
          withTimeout(
            node.exportAsync({ format: "PNG", constraint: { type: "WIDTH", value: 200 } }),
            5000
          )
          .then(function(data) { return { id: id, data: data }; })
          .catch(function() { return { id: id, data: null }; })
        );
      } else {
        promises.push(Promise.resolve({ id: id, data: null }));
      }
    })(nodeIds[i]);
  }
  return Promise.all(promises).then(function(results) {
    var thumbnails = {};
    for (var j = 0; j < results.length; j++) {
      thumbnails[results[j].id] = results[j].data;
    }
    return thumbnails;
  });
}

function applyRenames(renames) {
  var applied = 0;
  var errors = [];
  var createdNodes = [];
  var fontsToLoad = [];

  // Collect async operations (need font loading)
  var asyncOps = [];
  for (var i = 0; i < renames.length; i++) {
    if (renames[i].type === "text" || renames[i].type === "create_text" || renames[i].type === "set_mode") {
      asyncOps.push({ op: renames[i], originalIndex: i });
    }
  }

  // Process sync operations
  var syncRenames = [];
  var syncOriginalIndices = [];
  for (var j = 0; j < renames.length; j++) {
    if (renames[j].type !== "text" && renames[j].type !== "create_text" && renames[j].type !== "set_mode") {
      syncRenames.push(renames[j]);
      syncOriginalIndices.push(j);
    }
  }

  // Apply sync renames and moves
  for (var s = 0; s < syncRenames.length; s++) {
    var rename = syncRenames[s];
    try {
      var node = figma.getNodeById(rename.id);

      if (rename.type === "component_set_name") {
        if (!node) { errors.push("Node " + rename.id + " not found"); continue; }
        node.name = rename.newName;
        applied++;
      } else if (rename.type === "variant") {
        if (!node) { errors.push("Node " + rename.id + " not found"); continue; }
        node.name = rename.newName;
        applied++;
      } else if (rename.type === "property") {
        var componentSet = figma.getNodeById(rename.componentSetId);
        if (componentSet && componentSet.type === "COMPONENT_SET") {
          try {
            componentSet.editComponentProperty(rename.oldKey, {
              name: rename.newName
            });
            applied++;
          } catch (e) {
            errors.push("Could not rename property \"" + rename.oldKey + "\": " + e.message);
          }
        } else {
          errors.push("Component set " + rename.componentSetId + " not found");
        }
      } else if (rename.type === "move") {
        if (!node) { errors.push("Node " + rename.id + " not found"); continue; }
        if (typeof rename.x === "number") { node.x = rename.x; }
        if (typeof rename.y === "number") { node.y = rename.y; }
        applied++;
      } else if (rename.type === "resize_node") {
        if (!node) { errors.push("Node " + rename.id + " not found"); continue; }
        if (typeof rename.width === "number" && typeof rename.height === "number") {
          if (typeof node.resize === "function") {
            node.resize(rename.width, rename.height);
          } else {
            // Sections and some nodes use direct property assignment
            node.resizeWithoutConstraints(rename.width, rename.height);
          }
        }
        applied++;
      } else if (rename.type === "reorder") {
        if (!node) { errors.push("Node " + rename.id + " not found"); continue; }
        var parentNode = node.parent;
        if (parentNode) {
          var targetIndex = rename.index;
          if (typeof targetIndex === "number") {
            parentNode.insertChild(targetIndex, node);
          }
          applied++;
        }
      } else if (rename.type === "duplicate") {
        if (!node) { errors.push("Node " + rename.id + " not found"); continue; }
        var clone = node.clone();
        if (typeof rename.offsetX === "number") { clone.x = node.x + rename.offsetX; }
        if (typeof rename.offsetY === "number") { clone.y = node.y + rename.offsetY; }
        if (rename.name) { clone.name = rename.name; }
        createdNodes.push({ tempKey: "create_" + syncOriginalIndices[s], nodeId: clone.id, nodeName: clone.name, nodeType: clone.type });
        applied++;
      } else if (rename.type === "swap_variant") {
        if (!node) { errors.push("Node " + rename.id + " not found"); continue; }
        if (node.type !== "INSTANCE") {
          errors.push("Node " + rename.id + " is not an instance (type: " + node.type + ")");
          continue;
        }
        try {
          node.setProperties(rename.properties);
          applied++;
        } catch (e) {
          errors.push("swap_variant error on " + rename.id + ": " + e.message);
        }
      } else if (rename.type === "create_rectangle") {
        var rect = figma.createRectangle();
        if (typeof rename.x === "number") { rect.x = rename.x; }
        if (typeof rename.y === "number") { rect.y = rename.y; }
        if (typeof rename.width === "number" && typeof rename.height === "number") {
          rect.resize(rename.width, rename.height);
        }
        if (rename.name) { rect.name = rename.name; }
        if (typeof rename.cornerRadius === "number") { rect.cornerRadius = rename.cornerRadius; }
        if (rename.fills) { rect.fills = rename.fills; }
        if (rename.strokes) { rect.strokes = rename.strokes; }
        if (typeof rename.strokeWeight === "number") { rect.strokeWeight = rename.strokeWeight; }
        if (typeof rename.opacity === "number") { rect.opacity = rename.opacity; }
        if (rename.parentId) {
          var rectParent = figma.getNodeById(rename.parentId);
          if (rectParent && "appendChild" in rectParent) { rectParent.appendChild(rect); }
        }
        createdNodes.push({ tempKey: "create_" + syncOriginalIndices[s], nodeId: rect.id, nodeName: rect.name, nodeType: "RECTANGLE" });
        applied++;
      } else if (rename.type === "create_frame") {
        var frame = figma.createFrame();
        if (typeof rename.x === "number") { frame.x = rename.x; }
        if (typeof rename.y === "number") { frame.y = rename.y; }
        if (typeof rename.width === "number" && typeof rename.height === "number") {
          frame.resize(rename.width, rename.height);
        }
        if (rename.name) { frame.name = rename.name; }
        if (typeof rename.cornerRadius === "number") { frame.cornerRadius = rename.cornerRadius; }
        if (rename.fills) { frame.fills = rename.fills; }
        if (rename.clipsContent === false) { frame.clipsContent = false; }
        if (typeof rename.opacity === "number") { frame.opacity = rename.opacity; }
        if (rename.parentId) {
          var frameParent = figma.getNodeById(rename.parentId);
          if (frameParent && "appendChild" in frameParent) { frameParent.appendChild(frame); }
        }
        createdNodes.push({ tempKey: "create_" + syncOriginalIndices[s], nodeId: frame.id, nodeName: frame.name, nodeType: "FRAME" });
        applied++;
      } else if (rename.type === "create_ellipse") {
        var ellipse = figma.createEllipse();
        if (typeof rename.x === "number") { ellipse.x = rename.x; }
        if (typeof rename.y === "number") { ellipse.y = rename.y; }
        if (typeof rename.width === "number" && typeof rename.height === "number") {
          ellipse.resize(rename.width, rename.height);
        }
        if (rename.name) { ellipse.name = rename.name; }
        if (rename.fills) { ellipse.fills = rename.fills; }
        if (rename.strokes) { ellipse.strokes = rename.strokes; }
        if (typeof rename.strokeWeight === "number") { ellipse.strokeWeight = rename.strokeWeight; }
        if (typeof rename.opacity === "number") { ellipse.opacity = rename.opacity; }
        if (rename.parentId) {
          var ellipseParent = figma.getNodeById(rename.parentId);
          if (ellipseParent && "appendChild" in ellipseParent) { ellipseParent.appendChild(ellipse); }
        }
        createdNodes.push({ tempKey: "create_" + syncOriginalIndices[s], nodeId: ellipse.id, nodeName: ellipse.name, nodeType: "ELLIPSE" });
        applied++;
      } else if (rename.type === "create_line") {
        var line = figma.createLine();
        if (typeof rename.x === "number") { line.x = rename.x; }
        if (typeof rename.y === "number") { line.y = rename.y; }
        if (typeof rename.length === "number") { line.resize(rename.length, 0); }
        if (typeof rename.rotation === "number") { line.rotation = rename.rotation; }
        if (rename.name) { line.name = rename.name; }
        if (rename.strokes) { line.strokes = rename.strokes; }
        if (typeof rename.strokeWeight === "number") { line.strokeWeight = rename.strokeWeight; }
        if (typeof rename.opacity === "number") { line.opacity = rename.opacity; }
        createdNodes.push({ tempKey: "create_" + syncOriginalIndices[s], nodeId: line.id, nodeName: line.name, nodeType: "LINE" });
        applied++;
      } else if (rename.type === "delete") {
        if (!node) { errors.push("Node " + rename.id + " not found"); continue; }
        node.remove();
        applied++;
      }
    } catch (e) {
      errors.push("Error on " + rename.id + ": " + e.message);
    }
  }

  // Apply async operations (text edits and text creation need font loading)
  if (asyncOps.length === 0) {
    return Promise.resolve({ applied: applied, errors: errors, createdNodes: createdNodes });
  }

  var asyncPromises = [];
  for (var t = 0; t < asyncOps.length; t++) {
    asyncPromises.push((function (asyncOp) {
      var op = asyncOp.op;
      if (op.type === "text") {
        var textNode = figma.getNodeById(op.id);
        if (!textNode || textNode.type !== "TEXT") {
          errors.push("Text node " + op.id + " not found");
          return Promise.resolve();
        }
        var fontsUsed = textNode.getRangeAllFontNames(0, textNode.characters.length);
        var loadPromises = [];
        for (var f = 0; f < fontsUsed.length; f++) {
          loadPromises.push(figma.loadFontAsync(fontsUsed[f]));
        }
        return Promise.all(loadPromises).then(function () {
          textNode.characters = op.newText;
          applied++;
        }).catch(function (e) {
          errors.push("Font load error on " + op.id + ": " + e.message);
        });
      }

      if (op.type === "create_text") {
        var fontFamily = op.fontFamily || "Inter";
        var fontStyle = op.fontStyle || "Regular";
        var font = { family: fontFamily, style: fontStyle };
        var hasTextStyle = !!op.textStyleId;

        return figma.loadFontAsync(font).then(function () {
          var newText = figma.createText();

          if (hasTextStyle) {
            // Apply text style BEFORE setting characters, and never set fontName manually
            var style = figma.getStyleById(op.textStyleId);
            if (style) { newText.textStyleId = style.id; }
          } else {
            // No text style — set font manually
            newText.fontName = font;
          }

          newText.characters = op.characters || "";

          if (!hasTextStyle) {
            if (typeof op.fontSize === "number") { newText.fontSize = op.fontSize; }
            if (op.fontFamilyVariableId) {
              var fontFamilyVar = figma.variables.getVariableById(op.fontFamilyVariableId);
              if (fontFamilyVar) { newText.setBoundVariable("fontFamily", fontFamilyVar); }
            }
            if (op.fontStyleVariableId) {
              var fontStyleVar = figma.variables.getVariableById(op.fontStyleVariableId);
              if (fontStyleVar) { newText.setBoundVariable("fontStyle", fontStyleVar); }
            }
          }

          if (typeof op.x === "number") { newText.x = op.x; }
          if (typeof op.y === "number") { newText.y = op.y; }
          if (op.fills) { newText.fills = op.fills; }
          if (op.name) { newText.name = op.name; }
          // Bind fill color variable (works with or without text style)
          if (op.fillVariableId) {
            var fillVar = figma.variables.getVariableById(op.fillVariableId);
            if (fillVar) {
              var fillsCopy = JSON.parse(JSON.stringify(newText.fills));
              if (fillsCopy.length > 0) {
                fillsCopy[0] = figma.variables.setBoundVariableForPaint(fillsCopy[0], "color", fillVar);
                newText.fills = fillsCopy;
              }
            }
          }
          // Append to parent if specified
          if (op.parentId) {
            var parentNode = figma.getNodeById(op.parentId);
            if (parentNode && "appendChild" in parentNode) {
              parentNode.appendChild(newText);
            }
          }
          createdNodes.push({ tempKey: "create_" + asyncOp.originalIndex, nodeId: newText.id, nodeName: newText.name, nodeType: "TEXT" });
          applied++;
        }).catch(function (e) {
          errors.push("Create text error: " + e.message);
        });
      }

      if (op.type === "set_mode") {
        var modeNode = figma.getNodeById(op.id);
        if (!modeNode) {
          errors.push("Node " + op.id + " not found for set_mode");
          return Promise.resolve();
        }
        // Find all text nodes under this node and preload their fonts,
        // plus load fonts that the new mode will require
        var fontsToPreload = [];
        // Load explicitly specified fonts
        if (op.fonts && op.fonts.length > 0) {
          for (var fi = 0; fi < op.fonts.length; fi++) {
            fontsToPreload.push(figma.loadFontAsync(op.fonts[fi]));
          }
        }
        // Also find all text nodes under the target and load their current fonts
        var textDescendants = [];
        if ("findAllWithCriteria" in modeNode) {
          textDescendants = modeNode.findAllWithCriteria({ types: ["TEXT"] });
        } else if (modeNode.type === "TEXT") {
          textDescendants = [modeNode];
        }
        for (var td = 0; td < textDescendants.length; td++) {
          var tn = textDescendants[td];
          try {
            var tnFonts = tn.getRangeAllFontNames(0, tn.characters.length);
            for (var tf = 0; tf < tnFonts.length; tf++) {
              fontsToPreload.push(figma.loadFontAsync(tnFonts[tf]));
            }
          } catch (e) { /* skip mixed fonts */ }
        }
        // Also preload fonts from the variable collection's target mode
        // by checking bound font variables and resolving their values
        try {
          var collection = figma.variables.getVariableCollectionById(op.collectionId);
          if (collection) {
            for (var vIdx = 0; vIdx < collection.variableIds.length; vIdx++) {
              var v = figma.variables.getVariableById(collection.variableIds[vIdx]);
              if (v && v.resolvedType === "STRING" && (v.name.toLowerCase().indexOf("font") !== -1)) {
                var modeVal = v.valuesByMode[op.modeId];
                if (modeVal && typeof modeVal === "string") {
                  // Try common style pairings
                  var styles = ["Regular", "Medium", "Bold", "SemiBold", "Light"];
                  for (var si = 0; si < styles.length; si++) {
                    fontsToPreload.push(
                      figma.loadFontAsync({ family: modeVal, style: styles[si] }).catch(function () {})
                    );
                  }
                }
              }
            }
          }
        } catch (e) { /* best effort */ }

        return Promise.all(fontsToPreload).then(function () {
          modeNode.setExplicitVariableModeForCollection(op.collectionId, op.modeId);
          applied++;
        }).catch(function (e) {
          errors.push("Set mode error on " + op.id + ": " + e.message);
        });
      }

      return Promise.resolve();
    })(asyncOps[t]));
  }

  return Promise.all(asyncPromises).then(function () {
    return { applied: applied, errors: errors, createdNodes: createdNodes };
  });
}

figma.ui.onmessage = function (msg) {
  if (msg.type === "scan-selection") {
    var selection = figma.currentPage.selection;
    if (selection.length === 0) {
      figma.ui.postMessage({
        type: "scan-result",
        error: "Please select a component set, component, or frame containing components."
      });
      return;
    }

    var allComponents = [];
    var allTextNodes = [];
    var allInstances = [];

    for (var i = 0; i < selection.length; i++) {
      var extracted = extractAll(selection[i]);
      for (var c = 0; c < extracted.components.length; c++) {
        allComponents.push(extracted.components[c]);
      }
      for (var t = 0; t < extracted.textNodes.length; t++) {
        allTextNodes.push(extracted.textNodes[t]);
      }
      for (var n = 0; n < extracted.instances.length; n++) {
        allInstances.push(extracted.instances[n]);
      }
    }

    if (allComponents.length === 0 && allTextNodes.length === 0 && allInstances.length === 0) {
      figma.ui.postMessage({
        type: "scan-result",
        error: "No components, instances, or text nodes found in selection."
      });
    } else {
      figma.ui.postMessage({
        type: "scan-result",
        data: {
          components: allComponents,
          textNodes: allTextNodes,
          instances: allInstances
        }
      });
    }
  }

  if (msg.type === "scan-page") {
    var page = figma.currentPage;
    var allComponents = [];
    var allTextNodes = [];
    var allInstances = [];

    // Scan all top-level children on the page
    for (var pi = 0; pi < page.children.length; pi++) {
      var extracted = extractAll(page.children[pi]);
      for (var pc = 0; pc < extracted.components.length; pc++) {
        allComponents.push(extracted.components[pc]);
      }
      for (var pt = 0; pt < extracted.textNodes.length; pt++) {
        allTextNodes.push(extracted.textNodes[pt]);
      }
      for (var pn = 0; pn < extracted.instances.length; pn++) {
        allInstances.push(extracted.instances[pn]);
      }
    }

    if (allComponents.length === 0 && allTextNodes.length === 0 && allInstances.length === 0) {
      figma.ui.postMessage({
        type: "scan-result",
        scanMode: "page",
        pageName: page.name,
        error: "No components, instances, or text nodes found on this page."
      });
    } else {
      figma.ui.postMessage({
        type: "scan-result",
        scanMode: "page",
        pageName: page.name,
        data: {
          components: allComponents,
          textNodes: allTextNodes,
          instances: allInstances
        }
      });
    }
  }

  if (msg.type === "scan-variables") {
    try {
      var collections = figma.variables.getLocalVariableCollections();
      var result = { collections: [], totalVariables: 0 };

      for (var ci = 0; ci < collections.length; ci++) {
        var col = collections[ci];
        var colData = {
          id: col.id,
          name: col.name,
          modes: [],
          variables: []
        };

        for (var mi = 0; mi < col.modes.length; mi++) {
          colData.modes.push({
            modeId: col.modes[mi].modeId,
            name: col.modes[mi].name
          });
        }

        for (var vi = 0; vi < col.variableIds.length; vi++) {
          var variable = figma.variables.getVariableById(col.variableIds[vi]);
          if (!variable) continue;

          var varData = {
            id: variable.id,
            name: variable.name,
            resolvedType: variable.resolvedType,
            valuesByMode: {}
          };

          for (var mj = 0; mj < col.modes.length; mj++) {
            var modeId = col.modes[mj].modeId;
            var value = variable.valuesByMode[modeId];
            // Resolve alias references
            if (value && typeof value === "object" && value.type === "VARIABLE_ALIAS") {
              var aliasVar = figma.variables.getVariableById(value.id);
              varData.valuesByMode[modeId] = {
                type: "ALIAS",
                id: value.id,
                name: aliasVar ? aliasVar.name : "unknown"
              };
            } else {
              varData.valuesByMode[modeId] = value;
            }
          }

          colData.variables.push(varData);
          result.totalVariables++;
        }

        result.collections.push(colData);
      }

      figma.ui.postMessage({ type: "variables-result", data: result });
    } catch (e) {
      figma.ui.postMessage({ type: "variables-result", error: "Failed to scan variables: " + e.message });
    }
  }

  if (msg.type === "apply-renames") {
    applyRenames(msg.renames).then(function (result) {
      // Preserve existing figma.notify() feedback
      if (result.applied > 0) {
        figma.notify("Applied " + result.applied + " rename(s)");
      }
      if (result.errors.length > 0) {
        figma.notify(result.errors.length + " error(s) occurred", { error: true });
      }

      // Send apply-result immediately
      figma.ui.postMessage({
        type: "apply-result",
        applied: result.applied,
        errors: result.errors,
        createdNodes: result.createdNodes
      });

      // Capture after-thumbnails as separate async chain
      var afterIds = extractNodeIds(msg.renames, 20);
      // Add newly created node IDs
      for (var ci = 0; ci < result.createdNodes.length; ci++) {
        var found = false;
        for (var cj = 0; cj < afterIds.length; cj++) {
          if (afterIds[cj] === result.createdNodes[ci].nodeId) { found = true; break; }
        }
        if (!found && afterIds.length < 20) {
          afterIds.push(result.createdNodes[ci].nodeId);
        }
      }
      // Remove IDs of deleted nodes
      var deleteIds = {};
      for (var di = 0; di < msg.renames.length; di++) {
        if (msg.renames[di].type === "delete") {
          deleteIds[msg.renames[di].id] = true;
        }
      }
      var filteredIds = [];
      for (var fi = 0; fi < afterIds.length; fi++) {
        if (!deleteIds[afterIds[fi]]) {
          filteredIds.push(afterIds[fi]);
        }
      }

      captureNodeThumbnails(filteredIds).then(function(thumbnails) {
        figma.ui.postMessage({ type: "after-thumbnails", thumbnails: thumbnails });
      }).catch(function() {
        figma.ui.postMessage({ type: "after-thumbnails", thumbnails: {} });
      });
    });
    return;
  }

  if (msg.type === "capture-before") {
    try {
      var nodeIds = extractNodeIds(msg.operations, 20);
      captureNodeThumbnails(nodeIds).then(function(thumbnails) {
        figma.ui.postMessage({ type: "before-thumbnails", thumbnails: thumbnails });
      }).catch(function() {
        figma.ui.postMessage({ type: "before-thumbnails", thumbnails: {} });
      });
    } catch (e) {
      figma.ui.postMessage({ type: "before-thumbnails", thumbnails: {} });
    }
    return;
  }

  if (msg.type === "select-node") {
    var selectTarget = figma.getNodeById(msg.id);
    if (selectTarget) {
      figma.currentPage.selection = [selectTarget];
      figma.viewport.scrollAndZoomIntoView([selectTarget]);
      figma.ui.postMessage({ type: "select-node-result", id: msg.id, success: true });
    } else {
      figma.ui.postMessage({ type: "select-node-result", id: msg.id, success: false });
    }
    return;
  }

  if (msg.type === "deep-scan") {
    var deepSelection = figma.currentPage.selection;
    if (deepSelection.length === 0) {
      figma.ui.postMessage({ type: "deep-scan-result", error: "Please select a screen instance." });
      return;
    }
    var deepTarget = deepSelection[0];
    var deepInstances = deepScanInstances(deepTarget, [], 0, []);
    figma.ui.postMessage({
      type: "deep-scan-result",
      data: {
        rootId: deepTarget.id,
        rootName: deepTarget.name,
        rootWidth: deepTarget.width,
        rootHeight: deepTarget.height,
        instances: deepInstances
      }
    });
  }

  if (msg.type === "generate-variants") {
    var genSource = figma.getNodeById(msg.sourceId);
    if (!genSource) {
      figma.ui.postMessage({ type: "generate-result", error: "Source node not found" });
      return;
    }
    var combos = msg.combinations;
    var genCols = msg.gridColumns || 4;
    var genSpacingX = msg.gridSpacingX || 50;
    var genSpacingY = msg.gridSpacingY || 50;
    var genCount = 0;
    var genErrors = [];

    for (var gi = 0; gi < combos.length; gi++) {
      try {
        var genClone = genSource.clone();
        var gcol = gi % genCols;
        var grow = Math.floor(gi / genCols);
        genClone.x = genSource.x + (gcol + 1) * (genSource.width + genSpacingX);
        genClone.y = genSource.y + grow * (genSource.height + genSpacingY);

        if (combos[gi].name) {
          genClone.name = combos[gi].name;
        }

        var genChanges = combos[gi].changes;
        for (var gj = 0; gj < genChanges.length; gj++) {
          var gChange = genChanges[gj];
          var gTarget;
          if (gChange.path.length === 0) {
            gTarget = genClone;
          } else {
            gTarget = navigateToPath(genClone, gChange.path);
          }
          if (gTarget && gTarget.type === "INSTANCE") {
            try {
              gTarget.setProperties(gChange.properties);
            } catch (e) {
              genErrors.push("Props error at [" + gChange.path.join(",") + "]: " + e.message);
            }
          } else {
            genErrors.push("Target not found at [" + gChange.path.join(",") + "]");
          }
        }
        genCount++;
      } catch (e) {
        genErrors.push("Clone error: " + e.message);
      }
    }

    figma.ui.postMessage({
      type: "generate-result",
      generated: genCount,
      errors: genErrors
    });
    figma.notify("Generated " + genCount + " variant screen(s)");
  }

  if (msg.type === "capture-refresh-before") {
    try {
      var crbSelection = figma.currentPage.selection;
      if (crbSelection.length === 0) {
        figma.ui.postMessage({ type: "refresh-before-thumbnail", rootId: null, data: null });
        return;
      }
      var crbRoot = crbSelection[0];
      var crbRootId = crbRoot.id;
      withTimeout(crbRoot.exportAsync({ format: "PNG", constraint: { type: "WIDTH", value: 400 } }), 5000)
        .then(function(data) {
          figma.ui.postMessage({ type: "refresh-before-thumbnail", rootId: crbRootId, data: data });
        })
        .catch(function() {
          figma.ui.postMessage({ type: "refresh-before-thumbnail", rootId: crbRootId, data: null });
        });
    } catch (e) {
      figma.ui.postMessage({ type: "refresh-before-thumbnail", rootId: null, data: null });
    }
    return;
  }

  if (msg.type === "refresh-instances") {
    var refreshSelection = figma.currentPage.selection;
    if (refreshSelection.length === 0) {
      figma.ui.postMessage({
        type: "refresh-result",
        error: "Please select a screen or frame."
      });
      return;
    }

    var refreshRoot = refreshSelection[0];
    var instanceRecords = collectInstancePaths(refreshRoot, [], 0, []);

    if (instanceRecords.length === 0) {
      figma.ui.postMessage({
        type: "refresh-result",
        error: "No instances found in selection."
      });
      return;
    }

    // Sort by depth ascending (shallowest first) for top-down processing
    instanceRecords.sort(function (a, b) { return a.depth - b.depth; });

    var found = instanceRecords.length;
    var refreshed = 0;
    var skipped = 0;
    var instances = [];
    var refreshRootId = refreshRoot.id;
    var mode = msg.mode || "refresh";

    var importPromises = [];
    for (var ri = 0; ri < instanceRecords.length; ri++) {
      (function (record) {
        if (record.skipped) {
          skipped++;
          instances.push({ name: record.name, nodeId: record.nodeId, status: "skipped", reason: "Local or detached component" });
          return;
        }

        var targetNode = navigateToPath(refreshRoot, record.path);
        if (!targetNode || targetNode.type !== "INSTANCE") {
          skipped++;
          instances.push({ name: record.name, nodeId: record.nodeId, status: "skipped", reason: "Instance not found at path" });
          return;
        }

        var mc;
        try {
          mc = targetNode.mainComponent;
        } catch (e) {
          skipped++;
          instances.push({ name: targetNode.name, nodeId: targetNode.id, status: "skipped", reason: "No main component" });
          return;
        }
        if (!mc) {
          skipped++;
          instances.push({ name: targetNode.name, nodeId: targetNode.id, status: "skipped", reason: "No main component" });
          return;
        }

        var componentKey = mc.key;
        if (!componentKey || !mc.remote) {
          skipped++;
          instances.push({ name: targetNode.name, nodeId: targetNode.id, status: "skipped", reason: "Local component (not from library)" });
          return;
        }

        var promise = figma.importComponentByKeyAsync(componentKey).then(function (freshComponent) {
          var node = navigateToPath(refreshRoot, record.path);
          if (!node || node.type !== "INSTANCE") {
            skipped++;
            instances.push({ name: record.name, nodeId: null, status: "skipped", reason: "Instance moved or deleted during refresh" });
            return;
          }
          node.swapComponent(freshComponent);
          if (mode === "reset" || mode === "factory") {
            try { node.removeOverrides(); } catch (e) {}
          }
          refreshed++;
          instances.push({ name: node.name, nodeId: node.id, status: "refreshed" });
          if (mode !== "factory" && record.properties) {
            try {
              node.setProperties(record.properties);
            } catch (e) { /* property keys may have changed */ }
          }
        }).catch(function (e) {
          skipped++;
          instances.push({ name: record.name, nodeId: record.nodeId, status: "skipped", reason: "Library import failed" });
        });

        importPromises.push(promise);
      })(instanceRecords[ri]);
    }

    Promise.all(importPromises).then(function () {
      var notifyVerb = (mode === "reset") ? "Reset" : (mode === "factory") ? "Factory reset" : "Refreshed";
      figma.notify(notifyVerb + " " + refreshed + " instance(s)");
      figma.ui.postMessage({
        type: "refresh-result",
        found: found,
        refreshed: refreshed,
        skipped: skipped,
        rootId: refreshRootId,
        instances: instances,
        mode: mode
      });

      // Capture after-thumbnail
      try {
        var afterRoot = figma.getNodeById(refreshRootId);
        if (afterRoot && "exportAsync" in afterRoot) {
          withTimeout(afterRoot.exportAsync({ format: "PNG", constraint: { type: "WIDTH", value: 400 } }), 5000)
            .then(function(afterData) {
              figma.ui.postMessage({ type: "refresh-after-thumbnail", rootId: refreshRootId, data: afterData });
            })
            .catch(function() {
              figma.ui.postMessage({ type: "refresh-after-thumbnail", rootId: refreshRootId, data: null });
            });
        } else {
          figma.ui.postMessage({ type: "refresh-after-thumbnail", rootId: refreshRootId, data: null });
        }
      } catch (e) {
        figma.ui.postMessage({ type: "refresh-after-thumbnail", rootId: refreshRootId, data: null });
      }
    });
  }

  if (msg.type === "resize") {
    figma.ui.resize(msg.width, msg.height);
  }

  if (msg.type === "close") {
    figma.closePlugin();
  }
};
