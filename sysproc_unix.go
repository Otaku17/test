//go:build !windows

package main

import "syscall"

// getSysProcAttr retourne les attributs de processus pour Unix (macOS/Linux).
func getSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{}
}
