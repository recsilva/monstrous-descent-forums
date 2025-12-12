all:
	sudo systemctl start postgresql
	# kgx --tab -e "sudo -iu postgres & psql"
	kgx --tab -e "cd backend && node index.js; exec bash"
	kgx --tab -e "cloudflared tunnel run; exec bash"
	kgx --tab -e "npm run dev; exec bash"
	xdg-open "https://weightedwalk.org"   

clean:
	sudo systemctl stop postgresql
	exit
