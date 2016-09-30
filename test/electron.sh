#!/bin/bash
(
  code=$(electron-spawn `dirname $0`/electron.js \
    | tee /dev/fd/2 | grep ^EXIT | sed 's/^EXIT //')
  exit $code
) 2>&1
exit $?
