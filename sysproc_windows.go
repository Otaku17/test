//go:build windows

package main

import "syscall"

// getSysProcAttr retourne les attributs de processus pour Windows.
// CREATE_NEW_PROCESS_GROUP permet à l'installeur de s'exécuter indépendamment.
func getSysProcAttr() *syscall.SysProcAttr {
	return &syscall.SysProcAttr{
		CreationFlags: syscall.CREATE_NEW_PROCESS_GROUP,
	}
}
