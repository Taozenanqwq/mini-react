const createTextElement = (text) => {
  return {
    type: 'Text_Element',
    props: {
      nodeValue: text,
      children: []
    }
  }
}
export const createElement = (type, props, ...children) => {
  return {
    type,
    props: {
      ...props,
      children: children.map((child) =>
        typeof child === 'object' ? child : createTextElement(child)
      )
    }
  }
}

export const createDom = (fiber) => {
  const { domType, type, props } = fiber
  const dom =
    type === 'Text_Element'
      ? document.createTextNode(props.nodeValue)
      : document.createElement(
          type instanceof Function ? domType : type
        )
  for (let [k, v] of Object.entries(props)) {
    if (k !== 'children' && !k.startsWith('_')) {
      if (k.startsWith('on')) {
        k = k.toLowerCase().substring(2)
        dom.addEventListener(k, v)
      } else {
        dom[k] = v
      }
    }
  }
  return dom
}
