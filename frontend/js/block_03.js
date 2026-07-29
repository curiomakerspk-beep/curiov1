    (function applyFlyoutPatch() {
      var poll = setInterval(function () {
        if (typeof workspace !== 'undefined' && workspace != null && workspace.getToolbox && workspace.getToolbox() && workspace.getToolbox().getFlyout()) {
          clearInterval(poll);

          const flyout = workspace.getToolbox().getFlyout();
          const origPosition = flyout.position.bind(flyout);

          flyout.position = function () {
            this.CORNER_RADIUS = 16;

            const targetWorkspace = this.targetWorkspace;
            const mm = targetWorkspace.getMetricsManager();
            const origGetViewMetrics = mm.getViewMetrics.bind(mm);

            const toolboxElement = document.querySelector('.blocklyToolboxDiv, .blocklyToolbox');
            const bd = document.getElementById('blocklyDiv');

            // Force metrics height so Blockly properly clips overflowing blocks
            mm.getViewMetrics = function (opt_getWorkspaceCoordinates) {
              const metrics = origGetViewMetrics(opt_getWorkspaceCoordinates);
              if (toolboxElement) {
                const tbRect = toolboxElement.getBoundingClientRect();
                metrics.height = tbRect.height;
                metrics.viewHeight = tbRect.height;
              }
              return metrics;
            };

            // Perfectly align the top of the flyout to the top of the toolbox
            const origGetY = this.getY.bind(this);
            this.getY = function () {
              if (toolboxElement && bd) {
                return toolboxElement.getBoundingClientRect().top - bd.getBoundingClientRect().top;
              }
              return 20;
            };

            const origGetX = this.getX.bind(this);
            this.getX = function () {
              if (toolboxElement && bd) {
                return toolboxElement.getBoundingClientRect().right - bd.getBoundingClientRect().left + 2;
              }
              return 215;
            };

            origPosition();

            mm.getViewMetrics = origGetViewMetrics;
            this.getY = origGetY;
            this.getX = origGetX;
          };

          flyout.position();

          window.addEventListener('resize', () => {
            flyout.position();
          });

          if (flyout.show) {
            const origShow = flyout.show.bind(flyout);
            flyout.show = function (xml) {
              origShow(xml);

              // GUARANTEED HOOK: attach the background size lock AFTER flyout.show creates the SVG
              const bg = flyout.svgGroup_ ? flyout.svgGroup_.querySelector('.blocklyFlyoutBackground') : null;
              if (bg && !bg.__heightLocked) {
                bg.__heightLocked = true;
                const origSetAttr = bg.setAttribute.bind(bg);

                const enforceHeight = () => {
                  try {
                    let tb = null;
                    if (flyout.targetWorkspace && flyout.targetWorkspace.getToolbox) {
                      const toolbox = flyout.targetWorkspace.getToolbox();
                      if (toolbox) {
                        tb = toolbox.HtmlDiv || (toolbox.getHtmlDiv && toolbox.getHtmlDiv());
                      }
                    }
                    if (!tb) tb = document.querySelector('.blocklyToolboxDiv, .blocklyToolbox');

                    if (tb) {
                      const fw = flyout.getWidth ? flyout.getWidth() : (flyout.width_ || 280);

                      let tbContents = tb.querySelector('.blocklyToolboxContents');
                      let targetElem = (tbContents && tbContents.getBoundingClientRect().height > 50) ? tbContents : tb;

                      let fh = Math.max(100, targetElem.getBoundingClientRect().height);

                      const r = 16;
                      origSetAttr('d', `M 0,0 L ${fw - r},0 a ${r},${r} 0 0,1 ${r},${r} L ${fw}, ${fh - r} a ${r},${r} 0 0,1 -${r},${r} L 0,${fh} z`);

                      // CRITICAL FIX FOR OVERFLOWING BLOCKS:
                      // We must also update the clip path so blocks outside the new height are hidden!
                      if (flyout.svgGroup_) {
                        const workspaceGroup = flyout.svgGroup_.querySelector('.blocklyWorkspace');
                        if (workspaceGroup) {
                          const clipUrl = workspaceGroup.getAttribute('clip-path');
                          if (clipUrl) {
                            const match = clipUrl.match(/#([^'"\)]+)/);
                            if (match && match[1]) {
                              const clipId = match[1].trim();
                              const clipPathElem = document.getElementById(clipId);
                              if (clipPathElem) {
                                const rect = clipPathElem.querySelector('rect');
                                if (rect) {
                                  rect.setAttribute('height', fh);
                                }
                              }
                            }
                          }
                        }
                      }

                      // Also update Blockly's internal height so scrollbars know the new limit
                      flyout.height_ = fh;
                    }
                  } catch (e) {
                    console.error('enforceHeight error:', e);
                  }
                };

                bg.setAttribute = function (attr, val) {
                  if (attr === 'd') {
                    if (bg.__isUpdating) return;
                    bg.__isUpdating = true;
                    enforceHeight();
                    bg.__isUpdating = false;
                    return;
                  }
                  origSetAttr(attr, val);
                };

                if (!bg.__resizeObserver) {
                  bg.__resizeObserver = new ResizeObserver(() => {
                    enforceHeight();
                  });
                  const widgetDiv = document.querySelector('.blocklyWidgetDiv') || document.body;
                  bg.__resizeObserver.observe(widgetDiv);
                }

                enforceHeight();
              }

              setTimeout(() => { flyout.position(); }, 10);
            };
          }

          /* ═══════════════════════════════════════════════════════
             MBLOCK HOVER REVEAL — fixed:
             - Flyout panel stays STATIC (background never resized)
             - On hover: widen ALL clip-paths inside flyout + unlock
               overflow on parent containers so content is visible
             - On leave: everything restored
             ═══════════════════════════════════════════════════════ */
          (function mblockReveal(flyout) {

            var isOpen        = false;
            var enterTimer    = null;
            var leaveTimer    = null;
            var origSvgW      = null;
            var origSvgStyleW = null;
            var savedClips    = [];   // [{rect, origW}]
            var savedParents  = [];   // [{el, overflow, overflowX}]

            /* ── helpers ─────────────────────────────── */

            function getSVG() {
              var el = flyout.svgGroup_;
              while (el && el.tagName && el.tagName.toLowerCase() !== 'svg') {
                el = el.parentElement;
              }
              return el || null;
            }

            function getClipRects() {
              var g = flyout.svgGroup_;
              if (!g) return [];
              var rects = [];
              var elements = Array.prototype.slice.call(g.getElementsByTagName('*'));
              elements.push(g);
              elements.forEach(function(el) {
                var url = el.getAttribute('clip-path') || (el.style && el.style.clipPath) || window.getComputedStyle(el).clipPath;
                if (url && url !== 'none') {
                  var match = url.match(/#([^'"\)]+)/);
                  if (match && match[1]) {
                    var id = match[1].trim();
                    var clipEl = document.getElementById(id);
                    if (clipEl) {
                      var rect = clipEl.querySelector('rect');
                      if (rect && rects.indexOf(rect) === -1) {
                        rects.push(rect);
                      }
                    }
                  }
                }
              });
              return rects;
            }

            /* Set overflow:visible on element and save previous value */
            function unlockOverflow(el) {
              if (!el || !el.style) return;
              for (var i = 0; i < savedParents.length; i++) {
                if (savedParents[i].el === el) return;
              }
              savedParents.push({
                el       : el,
                overflow : el.style.overflow,
                overflowX: el.style.overflowX
              });
              el.style.overflow  = 'visible';
              el.style.overflowX = 'visible';
            }

            /* ── show full block content ───────────────── */

            function showFull() {
              if (isOpen) return;
              isOpen = true;
              savedParents = [];
              savedClips = [];

              try {
                // 1. Widen all flyout clip-path rects
                var rects = getClipRects();
                rects.forEach(function(rect) {
                  var origW = rect.getAttribute('width');
                  savedClips.push({ rect: rect, origW: origW });
                  Element.prototype.setAttribute.call(rect, 'width', '99999');
                });

                // 2. Unlock overflow on flyout group, SVG, and all parent HTML elements
                var g = flyout.svgGroup_;
                if (g) {
                  unlockOverflow(g);
                  
                  var ws = g.querySelector('.blocklyWorkspace');
                  if (ws) {
                    unlockOverflow(ws);
                  }
                }

                var svgEl = getSVG();
                unlockOverflow(svgEl);
                if (svgEl) {
                  // Save and physically widen the flyout SVG so browser won't clip blocks
                  if (origSvgW === null) origSvgW = svgEl.getAttribute('width');
                  svgEl.setAttribute('width', '99999');

                  if (origSvgStyleW === null) origSvgStyleW = svgEl.style.width;
                  svgEl.style.setProperty('width', '99999px', 'important');

                  var parent = svgEl.parentElement;
                  while (parent) {
                    unlockOverflow(parent);
                    parent = parent.parentElement;
                  }
                }
                // Also explicitly target #blocklyDiv which Blockly clips
                var bd = document.getElementById('blocklyDiv');
                if (bd) {
                  unlockOverflow(bd);
                }
              } catch (e) {
                console.error("Flyout reveal error: " + e.message);
              }
            }

            /* ── hide: restore everything ──────────────── */

            function hideFull() {
              isOpen = false;

              // Restore clip-paths
              savedClips.forEach(function(item) {
                if (item.rect && item.origW !== null) {
                  Element.prototype.setAttribute.call(item.rect, 'width', item.origW);
                }
              });
              savedClips = [];

              // Restore SVG width and style width
              var svgEl = getSVG();
              if (svgEl) {
                if (origSvgW !== null) svgEl.setAttribute('width', origSvgW);
                if (origSvgStyleW !== null) svgEl.style.width = origSvgStyleW;
              }
              origSvgW = null;
              origSvgStyleW = null;

              // Restore all parent overflow values
              savedParents.forEach(function(item) {
                item.el.style.overflow  = item.overflow;
                item.el.style.overflowX = item.overflowX;
              });
              savedParents = [];
            }

            /* ── debounced mouse handlers ───────────────── */

            function onEnter() {
              clearTimeout(leaveTimer);
              clearTimeout(enterTimer);
              enterTimer = setTimeout(showFull, 20);
            }

            function onLeave() {
              clearTimeout(enterTimer);
              leaveTimer = setTimeout(function() {
                // Safeguard: do not collapse if blockly dropdown or widget div is open
                if (typeof Blockly !== 'undefined') {
                  if ((Blockly.WidgetDiv && Blockly.WidgetDiv.isVisible && Blockly.WidgetDiv.isVisible()) ||
                      (Blockly.DropDownDiv && Blockly.DropDownDiv.isVisible && Blockly.DropDownDiv.isVisible())) {
                    // Re-schedule leave check
                    onLeave();
                    return;
                  }
                }
                hideFull();
              }, 150);
            }

            /* ── attach to the flyout background and workspace ───── */

            function attach() {
              var g = flyout.svgGroup_;
              if (!g) return;

              // 1. Attach to the background path
              var bg = g.querySelector('.blocklyFlyoutBackground');
              if (bg && !bg.__mblockRevealAttached) {
                bg.__mblockRevealAttached = true;
                bg.style.pointerEvents = 'all';
                bg.addEventListener('mouseenter', onEnter);
                bg.addEventListener('mouseleave', onLeave);
              }

              // 2. Attach to the workspace container (which holds the blocks)
              var ws = g.querySelector('.blocklyWorkspace');
              if (ws && !ws.__mblockRevealAttached) {
                ws.__mblockRevealAttached = true;
                ws.addEventListener('mouseenter', onEnter);
                ws.addEventListener('mouseleave', onLeave);
              }

              // 3. Fallback: also attach to the group container g itself
              if (!g.__mblockRevealAttached) {
                g.__mblockRevealAttached = true;
                g.addEventListener('mouseenter', onEnter);
                g.addEventListener('mouseleave', onLeave);
              }
            }

            /* ── hook flyout.show ───────────────────────── */

            var _orig = flyout.show.bind(flyout);
            flyout.show = function(xml) {
              if (isOpen) {
                hideFull();
              }
              _orig(xml);
              isOpen    = false;
              savedClips = [];
              savedParents = [];
              setTimeout(attach, 80);
            };

            setTimeout(attach, 500);

          })(flyout);
          /* ═══════════════════════ END MBLOCK REVEAL ════════════════════════ */

        }
      }, 100);
    })();