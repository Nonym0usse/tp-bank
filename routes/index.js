var express = require('express');
var router = express.Router();
var mongoose = require('mongoose');
const bcrypt = require('bcrypt');
var jwt = require('jsonwebtoken');
const NodeCache = require( "node-cache" );
const myCache = new NodeCache({ stdTTL: 300, checkperiod: 120 });


mongoose.connect('mongodb://127.0.0.1:27017/bank');
var db = mongoose.connection;

db.once('open', _ =>{
    console.log('Connected');
});

db.on('error', err => {
    console.log('Erreur de connexion' + err);
});


var schema = mongoose.Schema({ email: 'string', nom: 'string', civilite: 'string', prenom: 'string', datenaissance: 'string', adresse: 'string', identifiant: 'string', codepin: 'string', montant: 0.00  });
var UserModel = mongoose.model('Users', schema, 'users');

/* For signup. */

/**
 * Note : je n'ai pas gérér la vérification des comptes en doubles à l'inscription de l'utilisateur
 */

router.post('/signup', function(req, res) {
    var users = new UserModel();
    const saltRounds = 2;

    users.nom = req.body.nom;
    users.email = req.body.email;
    users.civilite = req.body.civilite;
    users.prenom = req.body.prenom;
    users.datenaissance = req.body.datenaissance;
    users.adresse = req.body.adresse;
    users.identifiant = "12345" + random() + "z" ;
    users.montant = 0.00;
    bcrypt.hash(req.body.codepin, saltRounds, function(err, hash) {
        if (!err) {
            users.codepin = hash;
                users.save(function (err) {
                if (err) {
                    res.send(err);
                }else{
                    res.status(200).send({message: 'Vous êtes à présent inscrit à la banque.'});
                }
            })
        } else {
            res.status(500).send({erreur: 'Erreur lors du cryptage du mot de passe'});
        }
    });
});

/* For signin */

router.post('/signin', function (req, res) {
    const codePin = req.body.codepin;
    if(req.body.email !== undefined && codePin !== undefined){
       db.collection("users").findOne({email: req.body.email}, function (err, data) {
         var match = bcrypt.compareSync(codePin, data.codepin);
         if(!match){
             res.status(403).send("Erreur mot de passe ou email");
         }else{
             const token = jwt.sign({_id: data._id}, 'ceciestunecle',  {algorithm: 'HS256', expiresIn: 86400});
             obj = { token: token};
             success = myCache.set( "token", obj, 86400 ); //stockage dans le cache serveur pour 24H
             res.status(200).send({token: token, auth: "Authentification : OK", compteId: data.identifiant});
         }
       });
    }else{
        res.send("Merci de remplir les champs");
    }
});

/* virement */

router.put('/deposit', function (req, res) {
    const montant = req.body.montant;
    const statut = res;

    session = myCache.get( "token" );
    if(session){
        if(montant <= -1){
            db.collection("users").findOne({email: req.body.email}, function (err, data) {
                if (montant >= data.montant)
                {
                    statut.status(400).send({error: 'Vous n avez pas assez d argent sur votre compte'});
                }else{
                    const newAmount = myParserInt(data.montant) + myParserInt(montant);
                    db.collection("users").updateOne({email: req.body.email}, {$set:{montant: newAmount}}, function(err, data) {
                        if (err) throw err;
                        statut.status(200).send({ok: montant + "€ ont été retirés de votre compte"});
                    });
                }
            });
        }else if (montant >= +1) {
            db.collection("users").findOne({email: req.body.email}, function (err, data) {
                const newAmount =  myParserInt(data.montant) + myParserInt(montant);
                db.collection("users").updateOne({email: req.body.email}, {$set: {montant: newAmount}}, function (err, data) {
                    if (err) throw err;
                    statut.status(200).send({ok: montant + "€ ont été ajoutés à votre compte"});
                });
            });
        }else{
            statut.status(400).send({error: 'Montant incorrect'});
        }
    }
    else{
        statut.status(403).send({error: 'vous devez etre authentifié'});
    }
});

/** AUTRES FONCTIONS **/

function myParserInt(x) {
    x = Number(x);
    return x >= 0 ? Math.floor(x) : Math.ceil(x);
}

function random() {
    return Math.floor(Math.random() * 8);
}


module.exports = router;
