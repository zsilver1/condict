import React, {
  MouseEvent,
  Ref,
  useState,
  useRef,
  useCallback,
} from 'react';

import genId from '@condict/gen-id';

import combineRefs from '../combine-refs';
import {RelativeParent} from '../placement';

import {MenuElement} from '.';
import MenuManager from './manager';
import ManagedMenu from './managed-menu';

export type Props = {
  menu: MenuElement;
  onToggle?: (open: boolean) => void;
  children: JSX.Element & {
    ref?: Ref<ChildType>;
  };
};

export type ChildType = RelativeParent & {
  focus: () => void;
};

const DefaultOnToggle = () => { };

const ContextMenuTrigger = (props: Props) => {
  const {
    menu,
    onToggle = DefaultOnToggle,
    children,
  } = props;

  const [menuId] = useState(genId);
  const menuRef = useRef<ManagedMenu>(null);
  const childRef = useRef<ChildType>(null);
  const managerRef = useRef<MenuManager>(null);
  const menuParentRef = useRef<RelativeParent>({ x: 0, y: 0});
  const openMenu = useCallback((e: MouseEvent) => {
    e.preventDefault();

    // Before the menu is open, we need to make sure there is a valid value
    // for menuParentRef, so the menu can be placed correctly. This event
    // can be triggered either by pointer (right-clicking, usually), or by
    // pressing the menu key on the keyboard. If you use the keyboard, then
    // the menu is placed relative to the trigger element; otherwise, it is
    // placed at the mouse pointer (or finger, if you're using touch).
    menuParentRef.current = e.button === 0 && childRef.current
      // No mouse button pressed - place relative to child element
      ? childRef.current
      // Mouse button pressed or child ref empty - place relative to mouse.
      : { x: e.clientX, y: e.clientY };

    if (managerRef.current && menuRef.current) {
      managerRef.current.open(menuRef.current);
      onToggle(true);
    }
  }, [onToggle]);
  const handleClose = useCallback(() => {
    if (childRef.current) {
      childRef.current.focus();
    }
    onToggle(false);
  }, [onToggle]);

  const menuWithExtra = React.cloneElement(menu, {
    id: menuId,
    parentRef: menuParentRef,
    ref: combineRefs(menuRef, menu.ref),
  });
  const childWithMenu = React.cloneElement(children, {
    'aria-owns': `${menuId} ${children.props['aria-owns'] || ''}`,
    onContextMenu: openMenu,
    ref: combineRefs(childRef, children.ref),
  });

  return <>
    {childWithMenu}
    <MenuManager onClose={handleClose} ref={managerRef}>
      {menuWithExtra}
    </MenuManager>
  </>;
};

export default ContextMenuTrigger;