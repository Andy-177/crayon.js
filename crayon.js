// crayon.js - A declarative HTML drawing library
(function(global) {
  'use strict';

  // Main crayon object
  const crayon = {
    _currentParent: null,
    _elements: [],
    _rootContainer: null
  };

  // Helper to create element with attributes
  function createElement(tag, attrs = {}) {
    const el = document.createElement(tag);
    Object.keys(attrs).forEach(key => {
      if (key === 'text') {
        el.textContent = attrs[key];
      } else if (key === 'html') {
        el.innerHTML = attrs[key];
      } else if (key === 'style' && typeof attrs[key] === 'object') {
        Object.assign(el.style, attrs[key]);
      } else if (key === 'events' && typeof attrs[key] === 'object') {
        Object.keys(attrs[key]).forEach(eventName => {
          el.addEventListener(eventName, attrs[key][eventName]);
        });
      } else if (key === 'value') {
        el.value = attrs[key];
      } else if (key === 'checked') {
        el.checked = attrs[key];
      } else if (key === 'disabled') {
        el.disabled = attrs[key];
      } else if (key === 'src') {
        el.src = attrs[key];
      } else if (key === 'href') {
        el.href = attrs[key];
      } else if (key === 'alt') {
        el.alt = attrs[key];
      } else {
        el.setAttribute(key, attrs[key]);
      }
    });
    return el;
  }

  // Drawer class for chainable operations
  class DrawerInstance {
    constructor(config) {
      this.config = config || {};
      this.element = null;
      this._parent = null;
      this._children = [];
      this._isDrawn = false;
      
      if (config && Object.keys(config).length > 0) {
        this.render();
      }
    }

    attr(attrConfig) {
      this.config.attr = attrConfig;
      if (this._isDrawn) {
        this._recreateElement();
      }
      return this;
    }

    draw(drawConfig) {
      this.config.draw = drawConfig;
      if (this._isDrawn && this.element) {
        drawer._applyRect(this.element, drawConfig);
      }
      return this;
    }

    place(placeConfig) {
      this.config.place = placeConfig;
      if (this._isDrawn && this.element) {
        drawer._applyPlacement(this.element, placeConfig);
      }
      return this;
    }

    style(styleConfig) {
      this.config.style = styleConfig;
      if (this._isDrawn && this.element) {
        drawer._applyStyle(this.element, styleConfig);
      }
      return this;
    }

    bind(parentInstance) {
      this.config.bind = parentInstance;
      if (this._isDrawn && this.element) {
        if (this.element.parentNode) {
          this.element.parentNode.removeChild(this.element);
        }
        
        let parent = null;
        if (parentInstance instanceof DrawerInstance) {
          if (!parentInstance._isDrawn) {
            parentInstance.render();
          }
          parent = parentInstance.element;
        } else {
          parent = parentInstance;
        }
        
        if (parent) {
          parent.appendChild(this.element);
        }
      }
      return this;
    }

    _recreateElement() {
      if (!this.element) return;
      
      const parent = this.element.parentNode;
      const nextSibling = this.element.nextSibling;
      
      const oldElement = this.element;
      oldElement.remove();
      
      const idx = crayon._elements.indexOf(oldElement);
      if (idx !== -1) crayon._elements.splice(idx, 1);
      
      this._isDrawn = false;
      this.element = null;
      this.render();
      
      if (parent) {
        if (nextSibling && nextSibling.parentNode === parent) {
          parent.insertBefore(this.element, nextSibling);
        } else {
          parent.appendChild(this.element);
        }
      }
    }

    render() {
      if (this._isDrawn) return this.element;
      
      const { attr, draw: drawConfig, style, place, bind } = this.config;

      let element = null;

      if (attr) {
        if (attr._type === 'widget') {
          element = createElement(attr.tag, attr.props);
        } else if (attr._type === 'layout') {
          element = createElement('div', {
            style: Object.assign({
              position: 'relative',
              padding: '10px'
            }, attr.style || {})
          });
          element._layoutChildren = [];
          element._layoutType = attr.layoutType;
          element._layoutConfig = attr.config;
          drawer._applyLayoutStyles(element, attr.layoutType, attr.config);
        } else if (attr._type === 'box') {
          element = createElement('div');
        } else {
          element = createElement('div', {
            style: { position: 'relative' }
          });
        }
      } else {
        element = createElement('div', {
          style: { position: 'relative' }
        });
      }

      if (style) {
        drawer._applyStyle(element, style);
      }

      if (place) {
        drawer._applyPlacement(element, place);
      }

      // 如果 drawConfig 是 null 或 undefined 或空对象，都视为铺满
      if (drawConfig === undefined || drawConfig === null || (typeof drawConfig === 'object' && Object.keys(drawConfig).length === 0)) {
        drawer._applyRect(element, null);
      } else {
        drawer._applyRect(element, drawConfig);
      }

      let parent = null;
      if (bind) {
        if (bind instanceof DrawerInstance) {
          if (!bind._isDrawn) {
            bind.render();
          }
          parent = bind.element;
        } else {
          parent = bind;
        }
      } else if (crayon._currentParent) {
        parent = crayon._currentParent;
      } else {
        parent = crayon._initRoot();
      }

      if (parent) {
        if (parent._layoutChildren !== undefined) {
          parent.appendChild(element);
          parent._layoutChildren.push(element);
          drawer._relayout(parent);
        } else {
          parent.appendChild(element);
        }
      }

      this.element = element;
      this._isDrawn = true;
      crayon._elements.push(element);

      return element;
    }

    getElement() {
      if (!this._isDrawn) {
        this.render();
      }
      return this.element;
    }

    remove() {
      if (this.element && this.element.parentNode) {
        this.element.parentNode.removeChild(this.element);
        const index = crayon._elements.indexOf(this.element);
        if (index !== -1) crayon._elements.splice(index, 1);
        this._isDrawn = false;
        this.element = null;
      }
      this._children = [];
      return this;
    }

    getConfig() {
      return this.config;
    }

    updateConfig(newConfig) {
      this.config = Object.assign({}, this.config, newConfig);
      if (this._isDrawn) {
        this._recreateElement();
      }
      return this;
    }

    destroy() {
      this.remove();
      this.config = null;
      this._parent = null;
      this._children = null;
    }
  }

  // Drawer object containing all drawing utilities
  const drawer = {
    draw: function(config) {
      return new DrawerInstance(config);
    },

    place: function(config) {
      if (!config || typeof config !== 'object') {
        throw new Error('crayon.drawer.place() requires an object with x, y, dx, or dy properties');
      }
      return config;
    },

    recter: function(config) {
      if (config === undefined || config === null || (typeof config === 'object' && Object.keys(config).length === 0)) {
        return null;
      }
      if (typeof config !== 'object') {
        throw new Error('crayon.drawer.recter() requires an object with w, h, x, y, dx, dy, sp, ep, dsp, or dep properties');
      }
      return config;
    },

    style: function(config) {
      if (!config || typeof config !== 'object') {
        throw new Error('crayon.drawer.style() requires an object with CSS properties');
      }
      return config;
    },

    _applyPlacement: function(element, place) {
      if (!place) return;
      if (!element.style.position) {
        element.style.position = 'absolute';
      }
      if (place.x !== undefined) element.style.left = place.x + 'px';
      if (place.y !== undefined) element.style.top = place.y + 'px';
      if (place.dx !== undefined) {
        const currentLeft = parseFloat(element.style.left) || 0;
        element.style.left = (currentLeft + place.dx) + 'px';
      }
      if (place.dy !== undefined) {
        const currentTop = parseFloat(element.style.top) || 0;
        element.style.top = (currentTop + place.dy) + 'px';
      }
    },

    _applyRect: function(element, rect) {
      if (!rect) {
        element.style.position = 'absolute';
        element.style.top = '0';
        element.style.left = '0';
        element.style.right = '0';
        element.style.bottom = '0';
        element.style.width = '100%';
        element.style.height = '100%';
        return;
      }
      
      if (!element.style.position) {
        element.style.position = 'absolute';
      }
      
      if (rect.w !== undefined && rect.h !== undefined) {
        element.style.width = rect.w + 'px';
        element.style.height = rect.h + 'px';
      }
      if (rect.x && rect.x.length === 2) {
        element.style.left = rect.x[0] + 'px';
        element.style.width = (rect.x[1] - rect.x[0]) + 'px';
      }
      if (rect.y && rect.y.length === 2) {
        element.style.top = rect.y[0] + 'px';
        element.style.height = (rect.y[1] - rect.y[0]) + 'px';
      }
      if (rect.dx && rect.dx.length === 2) {
        const currentLeft = parseFloat(element.style.left) || 0;
        element.style.left = (currentLeft + rect.dx[0]) + 'px';
        const currentWidth = parseFloat(element.style.width) || 0;
        element.style.width = (currentWidth + (rect.dx[1] - rect.dx[0])) + 'px';
      }
      if (rect.dy && rect.dy.length === 2) {
        const currentTop = parseFloat(element.style.top) || 0;
        element.style.top = (currentTop + rect.dy[0]) + 'px';
        const currentHeight = parseFloat(element.style.height) || 0;
        element.style.height = (currentHeight + (rect.dy[1] - rect.dy[0])) + 'px';
      }
      if (rect.sp) {
        element.style.left = rect.sp[0] + 'px';
        element.style.top = rect.sp[1] + 'px';
      }
      if (rect.ep) {
        const left = parseFloat(element.style.left) || 0;
        const top = parseFloat(element.style.top) || 0;
        element.style.width = (rect.ep[0] - left) + 'px';
        element.style.height = (rect.ep[1] - top) + 'px';
      }
      if (rect.dsp) {
        const currentLeft = parseFloat(element.style.left) || 0;
        const currentTop = parseFloat(element.style.top) || 0;
        element.style.left = (currentLeft + rect.dsp[0]) + 'px';
        element.style.top = (currentTop + rect.dsp[1]) + 'px';
      }
      if (rect.dep) {
        const currentLeft = parseFloat(element.style.left) || 0;
        const currentTop = parseFloat(element.style.top) || 0;
        const currentWidth = parseFloat(element.style.width) || 0;
        const currentHeight = parseFloat(element.style.height) || 0;
        element.style.width = (currentWidth + rect.dep[0]) + 'px';
        element.style.height = (currentHeight + rect.dep[1]) + 'px';
      }
    },

    _applyStyle: function(element, style) {
      if (!style) return;
      Object.keys(style).forEach(key => {
        const value = style[key];
        if (key === 'color') {
          element.style.color = value;
        } else {
          const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase();
          element.style[cssKey] = value;
          element.style[key] = value;
        }
      });
    },

    _applyLayoutStyles: function(element, layoutType, config) {
      const styles = {};
      
      switch(layoutType) {
        case 'flex':
          styles.display = 'flex';
          styles.flexDirection = config.direction || 'row';
          styles.justifyContent = config.justify || 'flex-start';
          styles.alignItems = config.align || 'stretch';
          styles.flexWrap = config.wrap || 'nowrap';
          styles.gap = (config.gap || 10) + 'px';
          break;
          
        case 'grid':
          styles.display = 'grid';
          if (config.columns) {
            if (Array.isArray(config.columns)) {
              styles.gridTemplateColumns = config.columns.join(' ');
            } else {
              styles.gridTemplateColumns = `repeat(${config.columns}, 1fr)`;
            }
          }
          if (config.rows) {
            if (Array.isArray(config.rows)) {
              styles.gridTemplateRows = config.rows.join(' ');
            } else {
              styles.gridTemplateRows = `repeat(${config.rows}, 1fr)`;
            }
          }
          styles.gap = (config.gap || 10) + 'px';
          if (config.autoFlow) styles.gridAutoFlow = config.autoFlow;
          break;
          
        case 'stack':
          styles.display = 'grid';
          styles.gridTemplateColumns = '1fr';
          styles.gridTemplateRows = '1fr';
          break;
          
        case 'flow':
          styles.display = 'block';
          styles.padding = (config.padding || 10) + 'px';
          break;
          
        case 'absolute':
          styles.position = 'relative';
          break;
      }
      
      Object.assign(element.style, styles);
    },

    _relayout: function(container) {
      if (!container._layoutChildren || container._layoutChildren.length === 0) return;
      
      const children = container._layoutChildren;
      const layoutType = container._layoutType || 'flex';
      const config = container._layoutConfig || {};
      
      switch(layoutType) {
        case 'flex':
        case 'grid':
        case 'stack':
        case 'flow':
          break;
          
        case 'absolute':
          children.forEach((child, index) => {
            child.style.position = 'absolute';
            if (config.positions && config.positions[index]) {
              const pos = config.positions[index];
              if (pos.left !== undefined) child.style.left = pos.left + 'px';
              if (pos.top !== undefined) child.style.top = pos.top + 'px';
              if (pos.right !== undefined) child.style.right = pos.right + 'px';
              if (pos.bottom !== undefined) child.style.bottom = pos.bottom + 'px';
            }
          });
          break;
      }
    }
  };

  // 初始化根容器 - 全屏占满，无装饰
  crayon._initRoot = function() {
    if (!crayon._rootContainer) {
      crayon._rootContainer = document.createElement('div');
      crayon._rootContainer.id = 'crayon-root';
      crayon._rootContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        overflow: hidden;
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      `;
      document.body.style.cssText = `
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
      `;
      document.documentElement.style.cssText = `
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
      `;
      document.body.appendChild(crayon._rootContainer);
    }
    return crayon._rootContainer;
  };

  // Widgets - 包含所有 HTML 元素
  const widget = {
    // 文本相关
    h1: function(props) {
      return {
        _type: 'widget',
        tag: 'h1',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontSize: '2em',
            fontWeight: 'bold',
            margin: '0.67em 0'
          }, props && props.style)
        })
      };
    },
    h2: function(props) {
      return {
        _type: 'widget',
        tag: 'h2',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontSize: '1.5em',
            fontWeight: 'bold',
            margin: '0.83em 0'
          }, props && props.style)
        })
      };
    },
    h3: function(props) {
      return {
        _type: 'widget',
        tag: 'h3',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontSize: '1.17em',
            fontWeight: 'bold',
            margin: '1em 0'
          }, props && props.style)
        })
      };
    },
    h4: function(props) {
      return {
        _type: 'widget',
        tag: 'h4',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontSize: '1em',
            fontWeight: 'bold',
            margin: '1.33em 0'
          }, props && props.style)
        })
      };
    },
    h5: function(props) {
      return {
        _type: 'widget',
        tag: 'h5',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontSize: '0.83em',
            fontWeight: 'bold',
            margin: '1.67em 0'
          }, props && props.style)
        })
      };
    },
    h6: function(props) {
      return {
        _type: 'widget',
        tag: 'h6',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontSize: '0.67em',
            fontWeight: 'bold',
            margin: '2.33em 0'
          }, props && props.style)
        })
      };
    },
    p: function(props) {
      return {
        _type: 'widget',
        tag: 'p',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            margin: '1em 0'
          }, props && props.style)
        })
      };
    },
    span: function(props) {
      return {
        _type: 'widget',
        tag: 'span',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    label: function(props) {
      return {
        _type: 'widget',
        tag: 'label',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontSize: '14px'
          }, props && props.style)
        })
      };
    },
    strong: function(props) {
      return {
        _type: 'widget',
        tag: 'strong',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontWeight: 'bold'
          }, props && props.style)
        })
      };
    },
    em: function(props) {
      return {
        _type: 'widget',
        tag: 'em',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontStyle: 'italic'
          }, props && props.style)
        })
      };
    },
    u: function(props) {
      return {
        _type: 'widget',
        tag: 'u',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            textDecoration: 'underline'
          }, props && props.style)
        })
      };
    },
    s: function(props) {
      return {
        _type: 'widget',
        tag: 's',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            textDecoration: 'line-through'
          }, props && props.style)
        })
      };
    },
    small: function(props) {
      return {
        _type: 'widget',
        tag: 'small',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontSize: 'smaller'
          }, props && props.style)
        })
      };
    },
    mark: function(props) {
      return {
        _type: 'widget',
        tag: 'mark',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            backgroundColor: 'yellow'
          }, props && props.style)
        })
      };
    },

    // 链接和媒体
    a: function(props) {
      return {
        _type: 'widget',
        tag: 'a',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            color: '#0066cc',
            textDecoration: 'none'
          }, props && props.style)
        })
      };
    },
    img: function(props) {
      return {
        _type: 'widget',
        tag: 'img',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },

    // 表单控件
    button: function(props) {
      return {
        _type: 'widget',
        tag: 'button',
        props: Object.assign({}, props, {
          style: Object.assign({
            padding: '8px 16px',
            cursor: 'pointer',
            border: '1px solid #ccc',
            borderRadius: '4px',
            backgroundColor: '#f0f0f0',
            position: 'relative',
            fontSize: '14px'
          }, props && props.style)
        })
      };
    },
    input: function(props) {
      return {
        _type: 'widget',
        tag: 'input',
        props: Object.assign({}, props, {
          style: Object.assign({
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            position: 'relative',
            fontSize: '14px'
          }, props && props.style)
        })
      };
    },
    textarea: function(props) {
      return {
        _type: 'widget',
        tag: 'textarea',
        props: Object.assign({}, props, {
          style: Object.assign({
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            position: 'relative',
            fontSize: '14px',
            resize: 'vertical'
          }, props && props.style)
        })
      };
    },
    select: function(props) {
      return {
        _type: 'widget',
        tag: 'select',
        props: Object.assign({}, props, {
          style: Object.assign({
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            position: 'relative',
            fontSize: '14px'
          }, props && props.style)
        })
      };
    },
    option: function(props) {
      return {
        _type: 'widget',
        tag: 'option',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    text: function(props) {
      return {
        _type: 'widget',
        tag: 'input',
        props: Object.assign({}, props, {
          type: 'text',
          style: Object.assign({
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            position: 'relative',
            fontSize: '14px'
          }, props && props.style)
        })
      };
    },
    password: function(props) {
      return {
        _type: 'widget',
        tag: 'input',
        props: Object.assign({}, props, {
          type: 'password',
          style: Object.assign({
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            position: 'relative',
            fontSize: '14px'
          }, props && props.style)
        })
      };
    },
    email: function(props) {
      return {
        _type: 'widget',
        tag: 'input',
        props: Object.assign({}, props, {
          type: 'email',
          style: Object.assign({
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            position: 'relative',
            fontSize: '14px'
          }, props && props.style)
        })
      };
    },
    number: function(props) {
      return {
        _type: 'widget',
        tag: 'input',
        props: Object.assign({}, props, {
          type: 'number',
          style: Object.assign({
            padding: '8px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            position: 'relative',
            fontSize: '14px'
          }, props && props.style)
        })
      };
    },
    checkbox: function(props) {
      return {
        _type: 'widget',
        tag: 'input',
        props: Object.assign({}, props, {
          type: 'checkbox',
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    radio: function(props) {
      return {
        _type: 'widget',
        tag: 'input',
        props: Object.assign({}, props, {
          type: 'radio',
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },

    // 布局和容器
    div: function(props) {
      return {
        _type: 'widget',
        tag: 'div',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    section: function(props) {
      return {
        _type: 'widget',
        tag: 'section',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    article: function(props) {
      return {
        _type: 'widget',
        tag: 'article',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    header: function(props) {
      return {
        _type: 'widget',
        tag: 'header',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    footer: function(props) {
      return {
        _type: 'widget',
        tag: 'footer',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    nav: function(props) {
      return {
        _type: 'widget',
        tag: 'nav',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    main: function(props) {
      return {
        _type: 'widget',
        tag: 'main',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    aside: function(props) {
      return {
        _type: 'widget',
        tag: 'aside',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },

    // 列表
    ul: function(props) {
      return {
        _type: 'widget',
        tag: 'ul',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            listStyle: 'disc',
            paddingLeft: '40px'
          }, props && props.style)
        })
      };
    },
    ol: function(props) {
      return {
        _type: 'widget',
        tag: 'ol',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            listStyle: 'decimal',
            paddingLeft: '40px'
          }, props && props.style)
        })
      };
    },
    li: function(props) {
      return {
        _type: 'widget',
        tag: 'li',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },

    // 表格
    table: function(props) {
      return {
        _type: 'widget',
        tag: 'table',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            borderCollapse: 'collapse'
          }, props && props.style)
        })
      };
    },
    tr: function(props) {
      return {
        _type: 'widget',
        tag: 'tr',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    td: function(props) {
      return {
        _type: 'widget',
        tag: 'td',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            border: '1px solid #ccc',
            padding: '8px'
          }, props && props.style)
        })
      };
    },
    th: function(props) {
      return {
        _type: 'widget',
        tag: 'th',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            border: '1px solid #ccc',
            padding: '8px',
            fontWeight: 'bold',
            backgroundColor: '#f0f0f0'
          }, props && props.style)
        })
      };
    },

    // 其他
    br: function(props) {
      return {
        _type: 'widget',
        tag: 'br',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative'
          }, props && props.style)
        })
      };
    },
    hr: function(props) {
      return {
        _type: 'widget',
        tag: 'hr',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            border: 'none',
            borderTop: '1px solid #ccc',
            margin: '20px 0'
          }, props && props.style)
        })
      };
    },
    pre: function(props) {
      return {
        _type: 'widget',
        tag: 'pre',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontFamily: 'monospace',
            whiteSpace: 'pre'
          }, props && props.style)
        })
      };
    },
    code: function(props) {
      return {
        _type: 'widget',
        tag: 'code',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            fontFamily: 'monospace'
          }, props && props.style)
        })
      };
    },
    blockquote: function(props) {
      return {
        _type: 'widget',
        tag: 'blockquote',
        props: Object.assign({}, props, {
          style: Object.assign({
            position: 'relative',
            margin: '0 0 0 40px',
            paddingLeft: '20px',
            borderLeft: '4px solid #ccc'
          }, props && props.style)
        })
      };
    }
  };

  // Layouts
  const layout = {
    linear: function(config) {
      return {
        _type: 'layout',
        layoutType: 'flex',
        config: {
          direction: config && config.orient === 'vertical' ? 'column' : 'row',
          justify: config && config.justify || 'flex-start',
          align: config && config.align || 'stretch',
          gap: config && config.gap || 10
        }
      };
    },
    
    flex: function(config) {
      return {
        _type: 'layout',
        layoutType: 'flex',
        config: {
          direction: config && config.direction || 'row',
          justify: config && config.justify || 'flex-start',
          align: config && config.align || 'stretch',
          wrap: config && config.wrap || 'nowrap',
          gap: config && config.gap || 10
        }
      };
    },
    
    grid: function(config) {
      return {
        _type: 'layout',
        layoutType: 'grid',
        config: {
          columns: config && config.columns || 3,
          rows: config && config.rows || undefined,
          gap: config && config.gap || 10,
          autoFlow: config && config.autoFlow || 'row'
        }
      };
    },
    
    stack: function(config) {
      return {
        _type: 'layout',
        layoutType: 'stack',
        config: {
          gap: config && config.gap || 0
        }
      };
    },
    
    flow: function(config) {
      return {
        _type: 'layout',
        layoutType: 'flow',
        config: {
          padding: config && config.padding || 10
        }
      };
    },
    
    absolute: function(config) {
      return {
        _type: 'layout',
        layoutType: 'absolute',
        config: {
          positions: config && config.positions || []
        }
      };
    }
  };

  // Box - 纯 div
  const box = {
    div: function() {
      return {
        _type: 'box'
      };
    }
  };

  // Set parent container
  function setParent(parent) {
    crayon._currentParent = parent;
  }

  // Clear all drawn elements
  function clear() {
    crayon._elements.forEach(el => {
      if (el.parentNode) {
        el.parentNode.removeChild(el);
      }
    });
    crayon._elements = [];
    if (crayon._rootContainer) {
      crayon._rootContainer.innerHTML = '';
    }
  }

  // Clear specific parent
  function clearParent(parent) {
    if (!parent) return;
    const toRemove = [];
    crayon._elements.forEach(el => {
      if (el.parentNode === parent) {
        toRemove.push(el);
      }
    });
    toRemove.forEach(el => {
      parent.removeChild(el);
      const idx = crayon._elements.indexOf(el);
      if (idx !== -1) crayon._elements.splice(idx, 1);
    });
  }

  // 创建导出对象
  const crayonLib = {
    drawer: drawer,
    widget: widget,
    layout: layout,
    box: box,
    setParent: setParent,
    clear: clear,
    clearParent: clearParent
  };

  // 兼容性导出处理
  if (typeof window !== 'undefined') {
    window.crayon = crayonLib;
  }

  if (typeof define === 'function' && define.amd) {
    define([], function() { return crayonLib; });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = crayonLib;
    if (module.exports.default === undefined) {
      module.exports.default = crayonLib;
    }
  }

  if (typeof global !== 'undefined') {
    global.crayonLib = crayonLib;
  }

})(typeof window !== 'undefined' ? window : this);
