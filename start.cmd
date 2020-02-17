@echo off
IF EXIST node_modules (
node .
) ELSE (
npm i
node .
)