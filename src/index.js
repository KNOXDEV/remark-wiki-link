import map from 'unist-util-map';

const LINK_REGEX = /^!?\[\[(.+?)\]\]/;

function locator (value, fromIndex) {
  const linkStart = value.indexOf('[', fromIndex);
  const embedStart = value.indexOf('!', fromIndex);
  return Math.min(linkStart, embedStart)
}

// pure function that takes in the fully formed wikiLink node and returns
// a new embed-ified node. Should only be called if an actual embed form is detected.
function toEmbedNode(pageName, wikiLinkNode) {
  let filetype = pageName.slice(pageName.lastIndexOf('.') + 1);

  let newData = {};

  switch (filetype) {
    case "mov":
    case "mp4":
    case "webm":
      newData = {
        hName: 'video',
        hProperties: {
          className: wikiLinkNode.data.hProperties.className,
          src: wikiLinkNode.data.hProperties.href,
        },
        hChildren: undefined
      }
      break;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    default:
      newData = {
        hName: 'img',
        hProperties: {
          className: wikiLinkNode.data.hProperties.className,
          src: wikiLinkNode.data.hProperties.href,
          alt: wikiLinkNode.data.alias
        },
        hChildren: undefined
      }
  }

  return {
    ...wikiLinkNode,
    data: {
      ...wikiLinkNode.data,
      ...newData
    }
  };
}

function wikiLinkPlugin(opts = {}) {
  let permalinks = opts.permalinks || [];
  let defaultPageResolver = (name) => [name.replace(/ /g, '_').toLowerCase()];
  let pageResolver = opts.pageResolver || defaultPageResolver
  let newClassName = opts.newClassName || 'new';
  let wikiLinkClassName = opts.wikiLinkClassName || 'internal';
  let defaultHrefTemplate = (permalink) => `#/page/${permalink}`
  let hrefTemplate = opts.hrefTemplate || defaultHrefTemplate
  let aliasDivider = opts.aliasDivider || ":";

  function isAlias(pageTitle) {
    return pageTitle.indexOf(aliasDivider) !== -1;
  }

  function parseAliasLink(pageTitle) {
    var [name, displayName] = pageTitle.split(aliasDivider);
    return { name, displayName }
  }

  function parsePageTitle(pageTitle) {
    if (isAlias(pageTitle)) {
      return parseAliasLink(pageTitle)
    }
    return {
      name: pageTitle,
      displayName: pageTitle
    }
  }

  function inlineTokenizer(eat, value) {
    let match = LINK_REGEX.exec(value);

    if (match) {
      const pageName = match[1].trim();
      const { name, displayName } = parsePageTitle(pageName)

      let pagePermalinks = pageResolver(name);
      let permalink = pagePermalinks.find(p => permalinks.indexOf(p) != -1);
      let exists = permalink != undefined;

      if (!exists) {
        permalink = pagePermalinks[0];
      }

      let classNames = wikiLinkClassName;
      if (!exists) {
        classNames += ' ' + newClassName;
      }

      let linkData = {
        type: 'wikiLink',
        value: name,
        data: {
          alias: displayName,
          permalink: permalink,
          exists: exists,
          hName: 'a',
          hProperties: {
            className: classNames,
            href: hrefTemplate(permalink)
          },
          hChildren: [{
            type: 'text',
            value: displayName
          }]
        },
      };

      // if this was an embed wiki link, we need to do some more processing
      if(match[0].startsWith("!")) {
        linkData = toEmbedNode(pageName, linkData);
      }

      return eat(match[0])(linkData);
    }
  }

  inlineTokenizer.locator = locator

  const Parser = this.Parser

  const inlineTokenizers = Parser.prototype.inlineTokenizers
  const inlineMethods = Parser.prototype.inlineMethods
  inlineTokenizers.wikiLink = inlineTokenizer
  inlineMethods.splice(inlineMethods.indexOf('link'), 0, 'wikiLink')

  // Stringify for wiki link
  const Compiler = this.Compiler

  if (Compiler != null) {
    const visitors = Compiler.prototype.visitors
    if (visitors) {
      visitors.wikiLink = function (node) {
        if (node.data.alias != node.value) {
          return `[[${node.value}${aliasDivider}${node.data.alias}]]`
        }
        return `[[${node.value}]]`
      }
    }
  }
}

module.exports = wikiLinkPlugin
