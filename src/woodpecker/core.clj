(ns woodpecker.core
  (:use [org.httpkit.server]
        [compojure.core :only [defroutes GET POST PUT DELETE ANY context]])
  (:require [compojure.route]
            [compojure.handler])
  (:require [org.httpkit.client :as http])
  (:require [clojure.data.json :as json])
  (:gen-class))

(def api-key
  (let [key-from-env (System/getenv "ASANA_API_KEY")]
    (if (empty? key-from-env)
      "1SK41kN.IkDtNBNaa7wGx2qJAE1lbeYb"
      key-from-env)))

(def options
  {:basic-auth [api-key ""]})

(defroutes all-routes
  (compojure.route/resources "/")
  (GET ["/asana/:url" :url #".*"] [url :as r]
       (println "GET " url r)
       (let [params (if (empty? (:query-params r))
                      options
                      (merge {:query-params (:query-params r)} options))
             response (http/get
                       (str "https://app.asana.com/api/1.0/" url)
                       (assoc params :as :text))]
         (println @response)
         {:status 200
          :headers {"Content-Type" "application/json; charset=UTF-8"}
          :body (:body @response)}
         )
       )
  (GET ["/asana2/:url" :url #".*"] [url :as r]
       (println "GET " url r)
       (let [params (if (empty? (:query-params r))
                      options
                      (merge {:query-params (:query-params r)} options))
             response (http/get
                       (str "https://app.asana.com/api/1.0/" url)
                       (assoc params :as :text))]
         (println (get (json/read-str (:body @response)) "data"))
         (let [data (get (json/read-str (:body @response)) "data")
               key (if (vector? data)
                     (first (clojure.string/split url #"/"))
                     (clojure.string/replace
                      (first (clojure.string/split url #"/"))
                      #"s$"
                      ""))]
           {:status 200
            :headers {"Content-Type" "application/json; charset=UTF-8"}
            :body (json/write-str {key data})})
         )
       )
  (POST ["/asana/:url" :url #".*"] [url :as r]
        (println "POST " url r)
        (let [params (if (empty? (:form-params r))
                       options
                       (merge {:form-params (:form-params r)} options))
              response (http/post
                        (str "https://app.asana.com/api/1.0/" url)
                        (assoc params :as :text))]
          (println @response)
          {:status 200
           :headers {"Content-Type" "application/json; charset=UTF-8"}
           :body (:body @response)}
          )
        )
  (POST ["/asana2/:url" :url #".*"] [url :as r]
        (println "POST " url r)
        (let [params (if (empty? (:form-params r))
                       options
                       (merge {:form-params (:form-params r)} options))
              response (http/post
                        (str "https://app.asana.com/api/1.0/" url)
                        (assoc params :as :text))]
          (println @response)
          {:status 200
           :headers {"Content-Type" "application/json; charset=UTF-8"}
           :body (json/write-str {(first (clojure.string/split url #"/"))
                                 (get (json/read-str (:body @response)) "data")})}
          )
        )
  (PUT ["/asana/:url" :url #".*"] [url :as r]
       (println "PUT " url r)
       (let [params (if (empty? (:form-params r))
                      options
                      (merge {:form-params (:form-params r)} options))
             response (http/put
                       (str "https://app.asana.com/api/1.0/" url)
                       (assoc params :as :text))]
         (println @response)
         {:status 200
          :headers {"Content-Type" "application/json; charset=UTF-8"}
          :body (:body @response)}
         ))
  (PUT ["/asana2/:url" :url #".*"] [url :as r]
       (println "PUT " url r)
       (let [params (if (empty? (:form-params r))
                      options
                      (merge {:form-params (:form-params r)} options))
             response (http/put
                       (str "https://app.asana.com/api/1.0/" url)
                       (assoc params :as :text))]
         (println @response)
         {:status 200
          :headers {"Content-Type" "application/json; charset=UTF-8"}
          :body (json/write-str {(first (clojure.string/split url #"/"))
                                 (get (json/read-str (:body @response)) "data")})}
         ))
  (ANY "/*" [] "not found"))

(def app
    (compojure.handler/site #'all-routes))
