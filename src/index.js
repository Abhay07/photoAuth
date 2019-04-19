const express = require('express')
const bodyParser = require('body-parser')
const https = require("https");


const app = express()
app.listen(8082, () => console.log('Example app listening on port 3000!'))


app.use(function (err, req, res, next) {
  res.status(500).send('Something broke!')
})

// app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}))

app.post('/upload',(req,res)=>{
	const imgUrl = req.body && req.body.message && (req.body.message.type === 'image') && req.body.message.body && req.body.message.body.url;
	const token = req.query.token;
	if(!imgUrl){
		console.log('No image');
		return res.status(500).send('No image');
	}

	if(!token){
		console.log('unauthorized');
		return res.status(401).send('Not authorized');
	}
	const downloadImg = ()=>{
		return new Promise((resolve,reject)=>{
			https.get(imgUrl, response => {
				resolve(response)
			});
		})
	}

	const convertToBuffer = (response)=>{
		const data = [];
		return new Promise((resolve,reject)=>{
			response.on('data', function(chunk) {
		        data.push(chunk);
		    }).on('end', function() {
		        //at this point data is an array of Buffers
		        //so Buffer.concat() can make us a new Buffer
		        //of all of them together
		        let buffer = Buffer.concat(data);
		        resolve(buffer);
		    });			
		})

	}

	const uploadFirst = (buffer)=>{
		const imgName = imgUrl.split("/").pop();
		const options = {
		    host: 'photoslibrary.googleapis.com',
		    path: '/v1/uploads',
		    method: 'POST',
		    headers: {
		        "Content-Type": "application/octet-stream",
		        "Authorization": "Bearer "+token,
		        "X-Goog-Upload-File-Name": imgName,
		        "X-Goog-Upload-Protocol": "raw"
		    }
		};
		return new Promise((resolve,reject)=>{
			const post_req = https.request(options, (res1, err) => {
			    if (res1.statusCode !== 200 || err) {
			    	console.log(res1.statusCode);
			    	return res.sendStatus(res1.statusCode);
			        reject(res1.statusCode);
			    }
			    let data = '';
			    res1.setEncoding('utf-8');
			    res1.on('data', function(chunk) {
			    	data += chunk;
			    })
			    .on('end',function(){
			    	resolve(data);
			    });
			})
			post_req.write(buffer);
			post_req.end()			
		})

	}

	const uploadSecond = (buffer)=>{
		const options = {
		    host: 'photoslibrary.googleapis.com',
		    path: '/v1/mediaItems:batchCreate',
		    method: 'POST',
		    headers: {
		        "Content-Type": "application/json",
		        "Authorization": "Bearer "+token,
		    }
		};
		const body = JSON.stringify({
		  "newMediaItems": [
		    {
		      "description": "caret image",
		      "simpleMediaItem": {
		        "uploadToken": buffer
		      }
		    }
		  ]
		})
		return  new Promise((resolve,reject)=>{
			const post_req = https.request(options, (res1, err) => {
			    if (err) {
			    	console.log(res1.statusCode);
			        reject(err);
			    }
			    res1.setEncoding('utf-8');
			    let data = '';
			    res1.on('data', function(chunk) {
			    	data+=(chunk);
			    })
			    .on('end',function(){
			    	resolve(JSON.parse(data));
			    });
			})
			post_req.write(body);
			post_req.end()
		})

	}

	downloadImg()
	.then(response=>{
		return convertToBuffer(response);
	})
	.then(buffer=>{
		return uploadFirst(buffer)
	})
	.then(buffer2=>{
		return uploadSecond(buffer2)
	})
	.then(response=>{
		console.log(response);
		res.send(response);
	})
	.catch(err=>{
		res.status(500).send('Something went wrong');
	})

})
