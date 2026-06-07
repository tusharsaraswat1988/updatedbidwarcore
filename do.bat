set CMD=commit 
git %%CMD%% -F commitmsg.txt 
git rev-parse HEAD>PUSH_RESULT.txt 
git push origin main>>PUSH_RESULT.txt 2>& 
