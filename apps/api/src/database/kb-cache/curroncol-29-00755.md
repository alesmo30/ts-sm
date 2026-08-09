# curroncol-29-00755

## chunk 0000
hash: aa60ec920eb1d5a36fc7d695fa3b622d3d0c4b20

**Original:**

Citation: Ou, Z.; Mao, W.; Tan, L.;

Yang, Y.; Liu, S.; Zhang, Y.; Li, B.;

Zhao, D. Prediction of Postoperative

Pathologic Risk Factors in Cervical

Cancer Patients Treated with Radical

Hysterectomy by Machine Learning.

Curr. Oncol. 2022, 29, 9613–9629.

https://doi.org/10.3390/

curroncol29120755

Received: 7 October 2022

Accepted: 29 November 2022

Published: 6 December 2022

Publisher’s Note: MDPI stays neutral

with regard to jurisdictional claims in

published maps and institutional affil-

iations.

Copyright: © 2022 by the authors.

Licensee MDPI, Basel, Switzerland.

This article is an open access article

distributed under the terms and

conditions of the Creative Commons

Attribution (CC BY) license (https://

creativecommons.org/licenses/by/

4.0/).

Article

Prediction of Postoperative Pathologic Risk Factors in Cervical

Cancer Patients Treated with Radical Hysterectomy by

Machine Learning

Zhengjie Ou 1,†, Wei Mao 1,†, Lihua Tan 1, Yanli Yang 2, Shuanghuan Liu 1, Yanan Zhang 1, Bin Li 1 and Dan Zhao 1,*

1 Department of Gynecology Oncology, National Cancer Center, National Clinical Research Center for Cancer,

Cancer Hospital, Chinese Academy of Medical Sciences, Peking Union Medical College, Beijing 100021, China

2 Department of Gynecology Oncology, The Fifth People’s Hospital of Qinghai Province, Xining 810007, China

* Correspondence: zhaodan@cicams.ac.cn; Tel.: +86-010-8778-7384; Fax: +86-097-1636-0700

**Traducción:**

Citación: Ou, Z.; Mao, W.; Tan, L.; Yang, Y.; Liu, S.; Zhang, Y.; Li, B.; Zhao, D. Predicción de factores de riesgo patológico postoperatorio en pacientes con cáncer cervical tratados con histerectomía radical mediante aprendizaje automático. Curr. Oncol. 2022, 29, 9613–9629. https://doi.org/10.3390/curroncol29120755

Recibido: 7 de octubre de 2022

Aceptado: 29 de noviembre de 2022

Publicado: 6 de diciembre de 2022

Nota del editor: MDPI se mantiene neutral con respecto a las reclamaciones jurisdiccionales en los mapas y afiliaciones institucionales publicados.

Derechos de autor: 2022 por los autores. Licencia MDPI, Basilea, Suiza.

Este artículo es un artículo de acceso abierto distribuido bajo los términos y condiciones de la licencia de Atribución de Creative Commons (CC BY) (https://creativecommons.org/licenses/by/4.0/).

Artículo

Predicción de factores de riesgo patológico postoperatorio en pacientes con cáncer cervical tratados con histerectomía radical mediante aprendizaje automático

Zhengjie Ou 1,†, Wei Mao 1,†, Lihua Tan 1, Yanli Yang 2, Shuanghuan Liu 1, Yanan Zhang 1, Bin Li 1 y Dan Zhao 1,*

1 Departamento de Oncología Ginecológica, Centro Nacional de Cáncer, Centro Nacional de Investigación Clínica para el Cáncer, Hospital de Cáncer, Academia China de Ciencias Médicas, Universidad Médica de la Unión de Pekín, Pekín 100021, China

2 Departamento de Oncología Ginecológica, El Quinto Hospital del Pueblo de la Provincia de Qinghai, Xining 810007, China

* Correo electrónico: zhaodan@cicams.ac.cn; Tel.: +86-010-8778-7384; Fax: +86-097-1636-0700
## chunk 0001
hash: 3a8a063dc92f8400af3e30ef8331b095d2cfa793

**Original:**

h People’s Hospital of Qinghai Province, Xining 810007, China

* Correspondence: zhaodan@cicams.ac.cn; Tel.: +86-010-8778-7384; Fax: +86-097-1636-0700

† These authors contributed equally to this work.

Abstract: Pretherapeutic serological parameters play a predictive role in pathologic risk factors

(PRF), which correlate with treatment and prognosis in cervical cancer (CC). However, the method of

pre-operative prediction to PRF is limited and the clinical availability of machine learning methods

remains unknown in CC. Overall, 1260 early-stage CC patients treated with radical hysterectomy (RH)

were randomly split into training and test cohorts. Six machine learning classifiers, including Gradient

Boosting Machine, Support Vector Machine with Gaussian kernel, Random Forest, Conditional

Random Forest, Naive Bayes, and Elastic Net, were used to derive diagnostic information from

nine clinical factors and 75 parameters readily available from pretreatment peripheral blood tests.

The best results were obtained by RF in deep stromal infiltration prediction with an accuracy of 70.8%

and AUC of 0.767. The highest accuracy and AUC for predicting lymphatic metastasis with Cforest

were 64.3% and 0.620, respectively. The highest accuracy of prediction for lymphavascular space

invasion with EN was 59.7% and the AUC was 0.628. Blood markers, including D-dimer and uric acid,

were associated with PRF. Machine learning methods can provide critical diagnostic prediction on

**Traducción:**

Hospital Popular de la Provincia de Qinghai, Xining 810007, China

* Correspondencia: zhaodan@cicams.ac.cn; Tel.: +86-010-8778-7384; Fax: +86-097-1636-0700

† Estos autores contribuyeron igualmente a este trabajo.

Resumen: Los parámetros serológicos preterapéuticos desempeñan un papel predictivo en los factores de riesgo patológico (FRP), que se correlacionan con el tratamiento y el pronóstico en el cáncer cervical (CC). Sin embargo, el método de predicción preoperatoria de FRP es limitado y la disponibilidad clínica de los métodos de aprendizaje automático permanece desconocida en el CC. En general, 1260 pacientes con CC en etapa temprana tratados con histerectomía radical (HR) fueron divididos aleatoriamente en cohortes de entrenamiento y prueba. Se utilizaron seis clasificadores de aprendizaje automático, incluyendo Máquina de Impulso de Gradiente, Máquina de Soporte Vectorial con núcleo gaussiano, Bosque Aleatorio, Bosque Aleatorio Condicional, Naive Bayes y Red Elástica, para derivar información diagnóstica de nueve factores clínicos y 75 parámetros disponibles fácilmente en pruebas de sangre periférica pretratamiento. Los mejores resultados se obtuvieron con RF en la predicción de infiltración profunda del estroma con una precisión del 70,8% y un AUC de 0,767. La mayor precisión y AUC para predecir la metástasis linfática con Cforest fueron del 64,3% y 0,620, respectivamente. La mayor precisión de predicción para la invasión del espacio linfático con EN fue del 59,7% y el AUC fue de 0,628. Los marcadores sanguíneos, incluyendo el dímero D y el ácido úrico, se asociaron con los FRP. Los métodos de aprendizaje automático pueden proporcionar una predicción diagnóstica crítica sobre
## chunk 0002
hash: c79903c35b9b7470bfb4207340d690a42b8cdef9

**Original:**

628. Blood markers, including D-dimer and uric acid,

were associated with PRF. Machine learning methods can provide critical diagnostic prediction on

PRF in CC before surgical intervention. The use of predictive algorithms may facilitate individualized

treatment options through diagnostic stratification.

Keywords: blood biomarker; cervical cancer; deep stromal infiltration; lymph node metastasis;

lymph-vascular space invasion; machine learning methods

1. Introduction

Cervical cancer remains one of the most frequent malignant tumors in women [1].

With the widespread application of human papillomavirus (HPV) vaccination and the

popularity of screening, patients diagnosed at early stages have accounted for the majority.

Radical hysterectomy (RH) is the standard-of-care treatment for these patients [2]. The

unavoidable problem after surgery is whether adjuvant treatment is required, which

is judged in accordance with postoperative pathological risk factors. The likelihood of

risk factors that increase the risk of recurrence is high, especially in stage IB3-IIA2 (the

2018 International Federation of Gynecology and Obstetrics, FIGO) due to large tumor

bulk [2]. Previous studies have illustrated that neoadjuvant chemotherapy (NACT) plus

surgery inhibited micro-metastasis and distant metastasis of tumors, and was associated

with a declined incidence of pathologic risk factors [3]. However, despite the fact that NACT

**Traducción:**

628. Los marcadores sanguíneos, incluyendo D-dímero y ácido úrico, 
estuvieron asociados con PRF. Los métodos de aprendizaje automático pueden proporcionar una predicción diagnóstica crítica sobre 
PRF en CC antes de la intervención quirúrgica. El uso de algoritmos predictivos puede facilitar opciones de tratamiento individualizadas a través de la estratificación diagnóstica.

Palabras clave: biomarcador sanguíneo; cáncer cervical; infiltración estromal profunda; metástasis ganglionar; 
invasión del espacio linfático-vascular; métodos de aprendizaje automático

1. Introducción

El cáncer cervical sigue siendo uno de los tumores malignos más frecuentes en mujeres [1]. 
Con la aplicación generalizada de la vacunación contra el virus del papiloma humano (VPH) y la 
popularidad de la detección, los pacientes diagnosticados en etapas tempranas han representado la mayoría. 
La histerectomía radical (HR) es el tratamiento estándar para estos pacientes [2]. El 
problema inevitable después de la cirugía es si se requiere tratamiento adyuvante, lo cual 
se juzga de acuerdo con los factores de riesgo patológico postoperatorio. La probabilidad de 
factores de riesgo que aumentan el riesgo de recurrencia es alta, especialmente en la etapa IB3-IIA2 (la 
Federación Internacional de Ginecología y Obstetricia de 2018, FIGO) debido a la gran masa tumoral [2]. Estudios previos han ilustrado que la quimioterapia neoadyuvante (NACT) más 
cirugía inhibió la micro-metástasis y la metástasis a distancia de los tumores, y estuvo asociada 
con una disminución de la incidencia de factores de riesgo patológico [3]. Sin embargo, a pesar de que la NACT
## chunk 0003
hash: ecbd3d0c7d317444449fd17299f118619a91fd57

**Original:**

is and distant metastasis of tumors, and was associated

with a declined incidence of pathologic risk factors [3]. However, despite the fact that NACT

reduces the rate of adjuvant therapy after surgery, patients treated with NACT cannot be

thoroughly free from radiotherapy and the adverse effects that radiotherapy brings.

In addition, concurrent chemoradiotherapy (CCRT) is also an alternative initial treat-

ment for early-stage cervical cancer, particularly for locally advanced cervical cancer. As for

a patient with several pathologic risk factors, conformed to the adjuvant therapy standard,

Curr. Oncol. 2022, 29, 9613–9629. https://doi.org/10.3390/curroncol29120755 https://www.mdpi.com/journal/curroncol

Curr. Oncol. 2022, 29 9614

CCRT should be considered as the initial therapy but not RH, which shortens the treatment

process for the same effect and reduces treatment costs [4]. With regard to patients staged

IB-IIA, according to the National Comprehensive Cancer Network (NCCN) guidelines,

concurrent chemoradiation and RH both serve as alternative primary treatment options,

sharing nearly therapeutic equivalence. However, increased morbidity and complications

have been specifically illustrated when surgery and radiotherapy are combined [5,6]. This

multimodal treatment modality has caused them to bear a double treatment burden and

increased medical cost. In addition, the successive therapeutic process also prolongs the

**Traducción:**

es y metástasis a distancia de tumores, y se asoció con una disminución de la incidencia de factores de riesgo patológico [3]. Sin embargo, a pesar de que la quimioterapia neoadyuvante (NACT) reduce la tasa de terapia adyuvante después de la cirugía, los pacientes tratados con NACT no pueden estar completamente libres de radioterapia y los efectos adversos que conlleva.

Además, la quimiorradioterapia concurrente (CCRT) también es un tratamiento inicial alternativo para el cáncer de cuello uterino en etapa temprana, particularmente para el cáncer de cuello uterino localmente avanzado. En cuanto a un paciente con varios factores de riesgo patológico, de acuerdo con el estándar de terapia adyuvante, la CCRT debe considerarse como la terapia inicial pero no la radioterapia histerectomía (RH), lo que acorta el proceso de tratamiento para el mismo efecto y reduce los costos de tratamiento [4]. Con respecto a los pacientes en etapa IB-IIA, según las pautas de la Red Nacional Integral de Cáncer (NCCN), la quimiorradiación concurrente y la RH ambos sirven como opciones de tratamiento primario alternativas, compartiendo una equivalencia terapéutica casi igual. Sin embargo, se han ilustrado específicamente una mayor morbilidad y complicaciones cuando se combinan la cirugía y la radioterapia [5,6]. Esta modalidad de tratamiento multimodal les ha hecho soportar una doble carga de tratamiento y un aumento en el costo médico. Además, el proceso terapéutico sucesivo también prolonga el
## chunk 0004
hash: 8b90443ef05127dfae8ba953be6bd962701af521

**Original:**

ality has caused them to bear a double treatment burden and

increased medical cost. In addition, the successive therapeutic process also prolongs the

treatment period, aggregates their side effects and affects quality of life in the long run.

Accordingly, it is necessary to construct a model to predict pathologic risk factors before

primary treatment, which will help select those for whom it is more appropriate to receive

direct chemoradiation therapy rather than RH. Additionally, the development of model

to predict postoperative pathologic risk factors is an important element for individual

prognosis stratification and personalized medicine.

Pathologic risk factors in cervical cancer include lymph node metastasis (LNM),

parametria infiltration, positive surgical margins, lymph-vascular space invasion (LVSI),

tumor size >4 cm and deep stromal infiltration (DSI) [2]. Previous studies illustrated that

many clinicopathologic factors were related to pathologic risk factors by common statistical

methods, but these methods were not suited to handle more complex data [7–9]. Machine

learning is a branch of artificial intelligence (AI) technology that allows the computer to con-

clude potential rules from complicated data of retrospective examples. AI technology has

been widely used to analyze clinical material to construct a model to predict clinicopatho-

logical factors and treatment outcome, acquiring a properly higher accuracy compared

**Traducción:**

La comorbilidad ha causado que soporten una doble carga de tratamiento y un aumento en el costo médico. Además, el proceso terapéutico sucesivo también prolonga el período de tratamiento, agrega efectos secundarios y afecta la calidad de vida a largo plazo.

En consecuencia, es necesario construir un modelo para predecir factores de riesgo patológico antes del tratamiento primario, lo que ayudará a seleccionar a aquellos para quienes es más adecuado recibir quimiorradioterapia directa en lugar de RH. Además, el desarrollo de un modelo para predecir factores de riesgo patológico postoperatorio es un elemento importante para la estratificación de la prognosis individual y la medicina personalizada.

Los factores de riesgo patológico en el cáncer de cuello uterino incluyen metástasis en los ganglios linfáticos (LNM), infiltración de la parmetria, márgenes quirúrgicos positivos, invasión del espacio linfático-vascular (LVSI), tamaño del tumor > 4 cm e infiltración del estroma profundo (DSI) [2]. Estudios previos ilustraron que muchos factores clínico-patológicos estaban relacionados con factores de riesgo patológico mediante métodos estadísticos comunes, pero estos métodos no estaban diseñados para manejar datos más complejos [7–9]. El aprendizaje automático es una rama de la tecnología de inteligencia artificial (IA) que permite que la computadora concluya reglas potenciales a partir de datos complicados de ejemplos retrospectivos. La tecnología de IA se ha utilizado ampliamente para analizar material clínico y construir un modelo para predecir factores clínico-patológicos y resultados del tratamiento, logrando una precisión significativamente mayor
## chunk 0005
hash: b7a140059663d0ae7e9aa5f31972e2b96da34fc6

**Original:**

 clinical material to construct a model to predict clinicopatho-

logical factors and treatment outcome, acquiring a properly higher accuracy compared

with traditional statistical methods [10–12]. Therefore, it is feasible and reasonable to apply

machine learning to the prediction of postoperative pathologic risk factors.

Based on the successful application of AI technology and the discovery of related fac-

tors with pathologic risk factors, we hypothesized that pretreatment of clinicopathological

factors would be effective in the prediction of postoperative pathologic risk factors by ma-

chine learning analysis in FIGO stage IB-IIA cervical cancer. In addition, because of the low

incidence rate of positive margins and parametria infiltration in primary cohorts and pre-

operative confirmation of tumor size via clinical palpation, this study’s outcome contained

a prediction of other pathologic risk factors. Therefore, in the present study, we aimed to

explore the construction of a model for predicting LNM, LVSI and DSI through machine

learning combing of clinicopathological biomarkers and explore unreported significant

parameters associated with these factors.

2. Materials and Methods

2.1. Patients and Considered Features

This was a retrospective cohort study of 1260 patients with FIGO stage (2003) IB

and IIA cervical cancer who were treated with RH with retroperitoneal lymphadenectomy

**Traducción:**

material clínico para construir un modelo que prediga factores clinicopatológicos y resultados del tratamiento, adquiriendo una precisión más alta en comparación con los métodos estadísticos tradicionales [10–12]. Por lo tanto, es factible y razonable aplicar el aprendizaje automático a la predicción de factores de riesgo patológico postoperatorio.

Basado en la aplicación exitosa de la tecnología de inteligencia artificial y el descubrimiento de factores relacionados con factores de riesgo patológico, hipotetizamos que el tratamiento previo de factores clinicopatológicos sería efectivo en la predicción de factores de riesgo patológico postoperatorio mediante análisis de aprendizaje automático en el cáncer de cuello uterino en la etapa IB-IIA de la FIGO. Además, debido a la baja tasa de incidencia de márgenes positivos y infiltración paramétrica en las cohortes primarias y la confirmación preoperatoria del tamaño del tumor mediante palpación clínica, el resultado de este estudio contenía una predicción de otros factores de riesgo patológico. Por lo tanto, en el presente estudio, nos propusimos explorar la construcción de un modelo para predecir la metástasis a los ganglios linfáticos (LNM), la invasión de los vasos linfáticos (LVSI) y la invasión del estroma (DSI) a través de la combinación de biomarcadores clinicopatológicos y explorar parámetros significativos no informados asociados con estos factores.

2. Materiales y Métodos

2.1. Pacientes y Características Consideradas

Este fue un estudio de cohorte retrospectivo de 1260 pacientes con cáncer de cuello uterino en la etapa IB y IIA de la FIGO (2003) que fueron tratados con histerectomía radical (RH) con linfadenectomía retroperitoneal
## chunk 0006
hash: 6847d3fcfe608ee61e538a81e9b8e003668fbef5

**Original:**

pective cohort study of 1260 patients with FIGO stage (2003) IB

and IIA cervical cancer who were treated with RH with retroperitoneal lymphadenectomy

between 2003 and 2017 in our institution (National Cancer Center/Cancer Hospital, Chinese

Academy of Medical Sciences; CICAMS). We retrospectively collected clinicopathological

parameters, including age at diagnosis, body mass index (BMI), menopausal status, clinical

FIGO stage, gross type, histologic grade, clinical tumor diameter, 75 preoperative peripheral

blood biomarkers, etc. (Table 1 and Table S1). Tumor diameter was obtained via clinical

palpation before surgical intervention.

Curr. Oncol. 2022, 29 9615

Table 1. Clinical and pathologic characteristics of 1260 patients with cervical cancer.

Variables

All

Patients

(n = 1260)

Training

Cohort

(n = 630)

Test

Cohort

(n = 630)

p Value

Age (years) 45 (18–74) 45 (18–74) 45 (21–73) 0.777

BMI (kg/m2) 23.6 (16.0–42.7) 23.6 (16.0–47.5) 23.7 (16.5–42.7) 0.453

Menopausal

status

Yes 353 (28.0%) 446 (70.8%) 461 (73.2%) 0.347

No 907 (72.0%) 184 (29.2%) 169 (26.8%)

Clinical tumor

diameter (cm) 3.5 (0.5–8.0) 3.5 (0.5–10.0) 3.5 (0.5–8.0) 0.211

Histology

Squamous

carcinoma 1053 (83.6%) 525 (83.3%) 528 (83.8%) 0.82

Adenocarcinoma 133 (10.6%) 69 (11.0%) 64 (10.2%) 0.647

Others 74 (5.8%) 36 (5.7%) 38 (6.0%) 0.811

FIGO stage

(2003)

IB1 707 (56.1%) 361 (57.3%) 346 (54.9%) 0.394

IB2 289 (22.9%) 142 (22.5%) 147 (23.3%) 0.738

**Traducción:**

Estudio de cohorte prospectivo de 1260 pacientes con cáncer cervical en estadio FIGO (2003) IB y IIA que fueron tratados con RH con linfadenectomía retroperitoneal entre 2003 y 2017 en nuestra institución (Centro Nacional de Cáncer/Hospital de Cáncer, Academia China de Ciencias Médicas; CICAMS). Recopilamos retrospectivamente parámetros clínico-patológicos, incluyendo edad al diagnóstico, índice de masa corporal (IMC), estado menopáusico, estadio clínico FIGO, tipo bruto, grado histológico, diámetro del tumor clínico, 75 biomarcadores sanguíneos periféricos preoperatorios, etc. (Tabla 1 y Tabla S1). El diámetro del tumor se obtuvo mediante palpación clínica antes de la intervención quirúrgica.

Curr. Oncol. 2022, 29 9615

Tabla 1. Características clínicas y patológicas de 1260 pacientes con cáncer cervical.

Variables

Todos

Pacientes

(n = 1260)

Cohorte de

entrenamiento

(n = 630)

Cohorte de

prueba

(n = 630)

Valor p

Edad (años) 45 (18–74) 45 (18–74) 45 (21–73) 0,777

IMC (kg/m2) 23,6 (16,0–42,7) 23,6 (16,0–47,5) 23,7 (16,5–42,7) 0,453

Estado menopáusico

Sí 353 (28,0%) 446 (70,8%) 461 (73,2%) 0,347

No 907 (72,0%) 184 (29,2%) 169 (26,8%)

Diámetro del tumor clínico (cm) 3,5 (0,5–8,0) 3,5 (0,5–10,0) 3,5 (0,5–8,0) 0,211

Histología

Carcinoma escamoso 1053 (83,6%) 525 (83,3%) 528 (83,8%) 0,82

Adenocarcinoma 133 (10,6%) 69 (11,0%) 64 (10,2%) 0,647

Otros 74 (5,8%) 36 (5,7%) 38 (6,0%) 0,811

Estadio FIGO (2003)

IB1 707 (56,1%) 361 (57,3%) 346 (54,9%) 0,394

IB2 289 (22,9%) 142 (22,5%) 147 (23,3%) 0,738
## chunk 0007
hash: 553180e2bb0f003546be8ebec7b4e78d968cfc5a

**Original:**

 74 (5.8%) 36 (5.7%) 38 (6.0%) 0.811

FIGO stage

(2003)

IB1 707 (56.1%) 361 (57.3%) 346 (54.9%) 0.394

IB2 289 (22.9%) 142 (22.5%) 147 (23.3%) 0.738

IIA1 135 (10.7%) 60 (9.5%) 75 (11.9%) 0.172

IIA2 129 (10.3%) 67 (10.6%) 62 (9.8%) 0.642

Gross type

Exophytic 1163 (92.3%) 587 (93.2%) 576 (91.4%) 0.245

Endophytic 97 (7.7%) 43 (6.8%) 54 (8.6%)

Previous

abdominal

surgery

Yes 255 (20.2%) 133 (21.1%) 122 (19.4%) 0.441

No 1005 (79.8%) 497 (78.9%) 508 (80.6%)

Histologic grade

Good 87 (6.9%) 43 (6.8%) 44 (7.0%) 0.912

Moderate 506 (40.2%) 256 (40.6%) 250 (39.7%) 0.73

Poor 667 (52.9%) 331 (52.5%) 336 (53.3%) 0.778

Deep stromal

infiltration

Negative 653 (51.8%) 335 (53.2%) 318 (50.5%) 0.338

Positive 607 (48.2%) 295 (46.8%) 312 (49.5%)

Lymph-vascular

space invasion

Negative 829 (65.8%) 415 (65.9%) 414 (65.7%) 0.953

Positive 431 (34.2%) 215 (34.1%) 216 (34.3%)

Lymph node

metastasis

Negative 1017 (80.7%) 496 (78.7%) 521 (82.7%) 0.074

Positive 243 (19.3%) 134 (21.3%) 109 (17.3%)

2.2. Data Splitting

We obtained 1260 samples after preliminary preprocessing: removing medically im-

possible data (containing obvious record error), removing the features with 10% missing

values and the samples with missing values. Variables of age, BMI, menopausal status,

clinical tumor diameter, histology, FIGO stage, gross type, previous abdominal surgery, his-

tologic grade (obtained via cervical biopsy preoperatively) and 75 pretreatment peripheral

**Traducción:**

74 (5,8%) 36 (5,7%) 38 (6,0%) 0,811

Etapa FIGO

(2003)

IB1 707 (56,1%) 361 (57,3%) 346 (54,9%) 0,394

IB2 289 (22,9%) 142 (22,5%) 147 (23,3%) 0,738

IIA1 135 (10,7%) 60 (9,5%) 75 (11,9%) 0,172

IIA2 129 (10,3%) 67 (10,6%) 62 (9,8%) 0,642

Tipo bruto

Exofítico 1163 (92,3%) 587 (93,2%) 576 (91,4%) 0,245

Endofítico 97 (7,7%) 43 (6,8%) 54 (8,6%)

Cirugía abdominal previa

Sí 255 (20,2%) 133 (21,1%) 122 (19,4%) 0,441

No 1005 (79,8%) 497 (78,9%) 508 (80,6%)

Grado histológico

Bueno 87 (6,9%) 43 (6,8%) 44 (7,0%) 0,912

Moderado 506 (40,2%) 256 (40,6%) 250 (39,7%) 0,73

Malo 667 (52,9%) 331 (52,5%) 336 (53,3%) 0,778

Infiltración estromal profunda

Negativo 653 (51,8%) 335 (53,2%) 318 (50,5%) 0,338

Positivo 607 (48,2%) 295 (46,8%) 312 (49,5%)

Invasión del espacio linfático-vascular

Negativo 829 (65,8%) 415 (65,9%) 414 (65,7%) 0,953

Positivo 431 (34,2%) 215 (34,1%) 216 (34,3%)

Metástasis en ganglios linfáticos

Negativo 1017 (80,7%) 496 (78,7%) 521 (82,7%) 0,074

Positivo 243 (19,3%) 134 (21,3%) 109 (17,3%)

2.2. División de datos

Obtuvimos 1260 muestras después de un preprocesamiento preliminar: eliminando datos médicamente imposibles (que contenían errores de registro obvios), eliminando las características con valores perdidos del 10% y las muestras con valores perdidos. Las variables de edad, IMC, estado menopáusico, diámetro del tumor clínico, histología, etapa FIGO, tipo bruto, cirugía abdominal previa, grado histológico (obtenido a través de biopsia cervical preoperatoria) y 75 periféricos pretratamiento
## chunk 0008
hash: 314aea77d73d7ad61e9e8101f62e7d9db08a71ee

**Original:**

, FIGO stage, gross type, previous abdominal surgery, his-

tologic grade (obtained via cervical biopsy preoperatively) and 75 pretreatment peripheral

blood markers were all incorporated into the model construction. We started to handle the

features: the continuous features were normalized and categorical features were one-hot

coded, and LinearSVC method with L1 penalty was used to choose features.

The dataset was split into training and test cohorts according to a ratio of 1:1 by

repeated random sampling until there was no significant difference (p value > 0.05) between

Curr. Oncol. 2022, 29 9616

the two cohorts with respect to the three tasks (Table 1). The p values were calculated

using Chi-square or Fisher exact test for categorical variables, and the student’s t-test or the

Mann–Whitney U test were conducted for analyzing normally distributed or non-normally

distributed continuous variables. This resulted in the training cohort and the test cohort

both having 630 patients.

2.3. Supervised Machine Learning Classifiers

In this study, we evaluated six types of supervised machine learning classifiers, in-

cluding GBM (Gradient Boosting Machine) [13,14], SVMRadial (Support Vector Machine

with Gaussian kernel) [15], RF (Random Forest) [16], Cforest (Conditional Random For-

est) [17], NB (Naive Bayes) [18] and EN (Elastic Net) [19]. In addition, a logistic regression

classifier was used as a baseline. R software version 4.2.1 with R package caret was used to

**Traducción:**

Etapa FIGO, tipo bruto, cirugía abdominal previa, grado histológico (obtenido a través de biopsia cervical preoperatoria) y 75 marcadores sanguíneos periféricos de pretamento fueron incorporados en la construcción del modelo. Empezamos a manejar las características: las características continuas fueron normalizadas y las características categóricas fueron codificadas de un solo calor, y se utilizó el método LinearSVC con penalización L1 para seleccionar características.

El conjunto de datos se dividió en cohortes de entrenamiento y prueba según una proporción de 1:1 mediante muestreo aleatorio repetido hasta que no hubo diferencia significativa (valor p > 0,05) entre las dos cohortes con respecto a las tres tareas (Tabla 1). Los valores p se calcularon utilizando la prueba de Chi-cuadrado o la prueba exacta de Fisher para variables categóricas, y se realizaron la prueba t de Student o la prueba U de Mann-Whitney para analizar variables continuas distribuidas normal o no normalmente. Esto resultó en que la cohorte de entrenamiento y la cohorte de prueba tuvieran ambos 630 pacientes.

2.3. Clasificadores de aprendizaje automático supervisado

En este estudio, evaluamos seis tipos de clasificadores de aprendizaje automático supervisado, incluyendo GBM (Máquina de impulso de gradiente) [13,14], SVMRadial (Máquina de vectores de soporte con núcleo gaussiano) [15], RF (Bosque aleatorio) [16], Cforest (Bosque aleatorio condicional) [17], NB (Naive Bayes) [18] y EN (Red elástica) [19]. Además, se utilizó un clasificador de regresión logística como línea base. Se utilizó el software R versión 4.2.1 con el paquete R caret para
## chunk 0009
hash: 1de6286647d513e97898109cf146b80cb7432d90

**Original:**

N (Elastic Net) [19]. In addition, a logistic regression

classifier was used as a baseline. R software version 4.2.1 with R package caret was used to

implement all classifiers. One hundred independent training sets were conducted using

different random seeds in order to calculate variable importance for prediction. We used the

median of variable importance acquired from each training as a representative value. The

importance of each variable was calculated using the varImp function of the caret package.

A RF classifier combines two machine learning techniques: bagging and random feature

selection consisting of a group of decision trees. Cforest is an algorithm using conditional

inference trees as base learners, implementing both the random forest and the bagging

ensemble algorithm. EN is a logistic regression classifier trained by using a regularized

method that linearly combines the L1 and L2 penalties of the lasso and ridge methods.

2.4. Model Assessment

To assess the performance of different models, we computed the accuracy (ACC)

and the area under the ROC curve (AUC) on the test cohort as our evaluation metrics.

Here, ACC was obtained by setting the threshold corresponding to the top left point of the

ROC curve. As the AUC is independent of the chosen threshold, we used it as the main

evaluation metric.

2.5. Confidence of Prediction and Shannon’s Information Gain

Shannon’s information gain was used to assess the prediction confidence [20]. If a

**Traducción:**

N (Red de Elasticidad) [19]. Además, se utilizó un clasificador de regresión logística como línea base. Se utilizó el software R versión 4.2.1 con el paquete R caret para implementar todos los clasificadores. Se realizaron cien conjuntos de entrenamiento independientes utilizando semillas aleatorias diferentes para calcular la importancia de las variables para la predicción. Se utilizó la mediana de la importancia de las variables adquirida de cada entrenamiento como valor representativo. La importancia de cada variable se calculó utilizando la función varImp del paquete caret.

Un clasificador RF combina dos técnicas de aprendizaje automático: bagging y selección aleatoria de características que consiste en un grupo de árboles de decisión. Cforest es un algoritmo que utiliza árboles de inferencia condicional como aprendices base, implementando tanto el bosque aleatorio como el algoritmo de conjunto de bagging. EN es un clasificador de regresión logística entrenado utilizando un método regularizado que combina linealmente las penalizaciones L1 y L2 de los métodos lasso y ridge.

2.4. Evaluación del Modelo

Para evaluar el rendimiento de los diferentes modelos, se calcularon la precisión (ACC) y el área bajo la curva ROC (AUC) en la cohorte de prueba como nuestras métricas de evaluación. Aquí, la ACC se obtuvo estableciendo el umbral correspondiente al punto superior izquierdo de la curva ROC. Como la AUC es independiente del umbral elegido, se utilizó como la métrica de evaluación principal.

2.5. Confianza de la Predicción y Ganancia de Información de Shannon

Se utilizó la ganancia de información de Shannon para evaluar la confianza de la predicción [20]. Si una
## chunk 0010
hash: d528a69908693f02efe1cd9042e27c504de8c5be

**Original:**

ric.

2.5. Confidence of Prediction and Shannon’s Information Gain

Shannon’s information gain was used to assess the prediction confidence [20]. If a

patient, i, is lacking the information concerning the class that the patient is included in

(k-class), the Shannon’s information entropy representing uncertainty is expressed with:

H(i) = log2 k

If a classifier provides prediction probabilities for each class, the entropy will be:

Hc(i) =

k

∑

j=1

pj(i) log2(pj(i))

Here, pj(i) is the predicted probability that the patient i is included in class j. Thus,

we obtain the information gain, i.e., information gained by the prediction:

IG(i) = H(i) Hc(i)

The individual information gain for each class is given by:

IGj(i) = pj(i) IG(i)

3. Results

3.1. Prediction of Deep Stromal Infiltration of Cervical Cancer Based on Multiple Preoperative

Blood Markers Using Machine Learning Methods

Depth of stromal invasion was evaluated by an experienced pathologist and was

recognized as significant, with more than one millimeter of invasion in the depth of the

Curr. Oncol. 2022, 29 9617

stroma in a microscopic examination. The status of the depth of stromal infiltration was

classified into two groups: “non-deep” and “deep”. The “deep” group referred to patients

who had an invasive carcinoma with greater than one-third stromal invasion according

to the pathologic findings. “Non-deep” indicated a carcinoma infiltrating no more than

**Traducción:**

2.5. Confianza de la predicción y ganancia de información de Shannon

Se utilizó la ganancia de información de Shannon para evaluar la confianza de la predicción [20]. Si un paciente, i, carece de información sobre la clase a la que pertenece el paciente (clase k), la entropía de información de Shannon que representa la incertidumbre se expresa con:

H(i) = log2 k

Si un clasificador proporciona probabilidades de predicción para cada clase, la entropía será:

Hc(i) = 
∑ 
j=1 
pj(i) log2(pj(i))

Aquí, pj(i) es la probabilidad predicha de que el paciente i esté incluido en la clase j. Por lo tanto, 
obtenemos la ganancia de información, es decir, la información ganada por la predicción:

IG(i) = H(i) - Hc(i)

La ganancia de información individual para cada clase se da por:

IGj(i) = pj(i) IG(i)

3. Resultados

3.1. Predicción de la infiltración estromal profunda del cáncer cervical basada en múltiples marcadores sanguíneos preoperatorios utilizando métodos de aprendizaje automático

La profundidad de la invasión estromal se evaluó mediante un patólogo experimentado y se reconoció como significativa, con más de un milímetro de invasión en la profundidad del estroma en un examen microscópico. El estado de la profundidad de la infiltración estromal se clasificó en dos grupos: "no profundo" y "profundo". El grupo "profundo" se refería a pacientes que tenían un carcinoma invasivo con más de un tercio de invasión estromal según los hallazgos patológicos. "No profundo" indicaba un carcinoma que infiltraba no más de
## chunk 0012
hash: 5b5d326163a0e257e6d56ce4d7eeb760ef9c09a0

**Original:**

and predicted 108 patients with non-deep infiltration as ones

with deep infiltration. When we considered the Shannon gain to represent the confidence

of predictions and chose those patients with certain higher confidence of predictions,

the predictions designated as higher confidence (>0.2 bits from Shannon information

gain computation) contained only 21 mispredictions out of 148 instances (Figure 1E). In

particular, for the predictions with higher confidence, if a patient was predicted as non-deep,

this was right at a rate of 1 7/52 = 86.5%.

Curr. Oncol. 2022, 29 9618Curr. Oncol. 2022, 29, FOR PEER REVIEW 6

Figure 1. Prediction of deep stromal infiltration of cervical cancer based on multiple preoperative

blood markers using machine learning methods. (A) ROC curves derived from logistic regression

for predicting deep stromal infiltration of cervical cancer based on all 75 peripheral blood markers

using machine learning methods compared with logistic regression. (B) Relative importance of var-

iables for prediction of deep stromal infiltration calculated in the RF. Variable importance is

Figure 1. Prediction of deep stromal infiltration of cervical cancer based on multiple preoperative

blood markers using machine learning methods. (A) ROC curves derived from logistic regression for

predicting deep stromal infiltration of cervical cancer based on all 75 peripheral blood markers using

**Traducción:**

y predijo 108 pacientes con infiltración no profunda como si tuvieran infiltración profunda. Cuando consideramos la ganancia de Shannon para representar la confianza de las predicciones y elegimos a aquellos pacientes con una confianza de predicción más alta, las predicciones designadas como de alta confianza (> 0,2 bits del cálculo de ganancia de información de Shannon) contenían solo 21 predicciones incorrectas de 148 instancias (Figura 1E). En particular, para las predicciones con mayor confianza, si un paciente fue predicho como no profundo, esto fue correcto a una tasa de 17/52 = 86,5%.

Curr. Oncol. 2022, 29 9618Curr. Oncol. 2022, 29, PARA REVISIÓN POR PARES 6

Figura 1. Predicción de infiltración estromal profunda de cáncer cervical basada en múltiples marcadores sanguíneos preoperatorios utilizando métodos de aprendizaje automático. (A) Curvas ROC derivadas de regresión logística para predecir la infiltración estromal profunda de cáncer cervical basada en todos los 75 marcadores sanguíneos periféricos utilizando métodos de aprendizaje automático en comparación con la regresión logística. (B) Importancia relativa de variables para la predicción de infiltración estromal profunda calculada en el RF. La importancia de la variable es 

Figura 1. Predicción de infiltración estromal profunda de cáncer cervical basada en múltiples marcadores sanguíneos preoperatorios utilizando métodos de aprendizaje automático. (A) Curvas ROC derivadas de regresión logística para predecir la infiltración estromal profunda de cáncer cervical basada en todos los 75 marcadores sanguíneos periféricos utilizando métodos de aprendizaje automático
## chunk 0011
hash: 0178639adf4d1e987639fc4630662c90c6059e66

**Original:**

rcinoma with greater than one-third stromal invasion according

to the pathologic findings. “Non-deep” indicated a carcinoma infiltrating no more than

one third of the cervical stroma. The values for the highest ACC of the prediction and

the AUC were 70.8% and 0.767 with RF classifier, which achieved a 5.4% higher score

than the traditional method of multiple logistic regression analysis in AUC (Figure 1A;

Supplemental Table S2). It is notable that the best two classifiers, RF and GBM, both used

ensemble methods that combine weak decision trees.

Next, we focused on the best model, RF, and understood the variables. The relative

importance of each variable for segregating deep stromal infiltration patients from non-

deep infiltration ones was calculated for RF (Figure 1B). We identified the top eight factors,

including SCC, D-D, tumor diameter, URIC, age, neut%, ALP and TP, as important RF

predictors for distinguishing deep infiltration from non-deep infiltration. Standard box

plots that presented the distribution of each variable between deep and non-deep samples

are shown in Figure 1C.

Interestingly, we found that D-D was a critical variable, in addition to SCC. From

the confusion matrix (Figure 1D), RF predicted 81 patients with deep infiltration as ones

with non-deep infiltration and predicted 108 patients with non-deep infiltration as ones

with deep infiltration. When we considered the Shannon gain to represent the confidence

**Traducción:**

Carcinoma con más de un tercio de invasión estromal según los hallazgos patológicos. "No profundo" indicó un carcinoma que infiltraba no más de un tercio del estroma cervical. Los valores para el ACC más alto de la predicción y el AUC fueron 70,8% y 0,767 con el clasificador RF, que logró una puntuación 5,4% más alta que el método tradicional de análisis de regresión logística múltiple en AUC (Figura 1A; Tabla suplementaria S2). Es notable que los dos mejores clasificadores, RF y GBM, ambos utilizaron métodos de conjunto que combinan árboles de decisión débiles.

A continuación, nos centramos en el mejor modelo, RF, y comprendimos las variables. La importancia relativa de cada variable para segregar a los pacientes con infiltración estromal profunda de los que no tenían infiltración profunda se calculó para RF (Figura 1B). Identificamos los ocho factores principales, incluyendo SCC, D-D, diámetro del tumor, URIC, edad, neut%, ALP y TP, como predictores importantes de RF para distinguir la infiltración profunda de la no profunda. Las gráficas de caja estándar que presentan la distribución de cada variable entre las muestras profundas y no profundas se muestran en la Figura 1C.

Resultó interesante que encontramos que D-D era una variable crítica, además de SCC. A partir de la matriz de confusión (Figura 1D), RF predijo a 81 pacientes con infiltración profunda como si tuvieran infiltración no profunda y predijo a 108 pacientes con infiltración no profunda como si tuvieran infiltración profunda. Cuando consideramos la ganancia de Shannon para representar la confianza
## chunk 0013
hash: d1cc790f1de185c3212b1842e29879e5889c2e57

**Original:**

OC curves derived from logistic regression for

predicting deep stromal infiltration of cervical cancer based on all 75 peripheral blood markers using

machine learning methods compared with logistic regression. (B) Relative importance of variables

for prediction of deep stromal infiltration calculated in the RF. Variable importance is represented as

Curr. Oncol. 2022, 29 9619

a percentage of the highest value. (C) Box and jitter plots representing the distribution of top

eight important parameters for distinguishing infiltration from non-infiltration. (D,E), Confusion

matrix indicating the prediction quality of the RF classification for all predictions (D) and for those

predictions with high (>0.2 bits) confidence (E). Notes: SCC, squamous cell carcinoma antigen; D-

D, D-dimer; URIC, uric acid; ALP, alkaline phosphatase; TP, total protein; IgA, immunoglobulin

A; LDH, lactate dehydrogenase; TT, thrombin time; PT(A), plasma prothrombin time ratio (A);

MONO%, percentage of monocytes; HCT, hematocrit; HGB, hemoglobin; CK-MB, creatine kinase-MB

isoenzyme; b1-G, beta 1 globulin; PT(r), plasma prothrombin time ratio (r).

3.2. Differentiation of Lymph Node Metastasis of Cervical Cancer with Machine Learning Methods

The status of lymph node metastasis was classified into two groups: “metastasis” and

“non-metastasis”. We found that Cforest showed the best prediction performance with an

ACC of 64.3% and an AUC of 0.620 (Figure 2A; Supplemental Table S2), which achieved a

**Traducción:**

Curvas OC derivadas de regresión logística para predecir la infiltración estromal profunda del cáncer de cuello uterino en función de los 75 marcadores de sangre periférica utilizando métodos de aprendizaje automático en comparación con la regresión logística. (B) Importancia relativa de las variables para la predicción de la infiltración estromal profunda calculada en el RF. La importancia de las variables se representa como un porcentaje del valor más alto. (C) Gráficos de caja y dispersión que representan la distribución de los ocho parámetros más importantes para distinguir la infiltración de la no infiltración. (D, E), Matriz de confusión que indica la calidad de la predicción de la clasificación RF para todas las predicciones (D) y para aquellas predicciones con alta confianza (> 0,2 bits) (E). Notas: SCC, antígeno de carcinoma de células escamosas; D-D, dímero D; URIC, ácido úrico; ALP, fosfatasa alcalina; TP, proteína total; IgA, inmunoglobulina A; LDH, lactato deshidrogenasa; TT, tiempo de trombina; PT(A), razón de tiempo de protrombina en plasma (A); MONO%, porcentaje de monocitos; HCT, hematocrito; HGB, hemoglobina; CK-MB, isoenzima creatina quinasa-MB; b1-G, globulina beta 1; PT(r), razón de tiempo de protrombina en plasma (r).

3.2. Diferenciación de la metástasis de ganglios linfáticos del cáncer de cuello uterino con métodos de aprendizaje automático

El estado de la metástasis de ganglios linfáticos se clasificó en dos grupos: "metástasis" y "no metástasis". Encontramos que Cforest mostró el mejor rendimiento de predicción con un ACC del 64,3% y un AUC de 0,620 (Figura 2A; Tabla suplementaria S2), lo que logró un
## chunk 0014
hash: cbf7a0e567c74d11ec3ff3dccfc93d6a34082ef6

**Original:**

und that Cforest showed the best prediction performance with an

ACC of 64.3% and an AUC of 0.620 (Figure 2A; Supplemental Table S2), which achieved a

5.8% higher score than LR in AUC.

Next, the relative importance of a variable for segregating metastatic patients from

non-metastatic ones was calculated for Cforest (Figure 2B). We identified the top eight

factors, including SCC, IB2, IB1, MONO%, diameter, PT(A), HCT and TT, as important

Cforest predictors for distinguishing metastatic patients from non-metastatic ones. It

should be noted that as the clinical stage progresses, SCC and tumor diameter can increase.

Standard box plots that presented the distribution of each variable between metastatic and

non-metastatic samples are shown in Figure 2C.

Interestingly, we found that SCC was a critical variable. From the confusion matrix

(Figure 2D), RF predictions had 105 false negative samples and 13 false positive samples.

However, predictions designated as higher confidence (>0.2 bits from Shannon information

gain computation) contained only 29 misprediction out of 230 instances (Figure 3E). In

particular, for the predictions with higher confidence, if a patient was predicted as non-

metastasis, this was right at a rate of 1 29/230 = 87.4%.

Curr. Oncol. 2022, 29 9620Curr. Oncol. 2022, 29, FOR PEER REVIEW 8

Figure 2. Differentiation of lymph node metastasis of cervical cancer with machine learning meth-

**Traducción:**

Encontramos que Cforest mostró el mejor rendimiento de predicción con un ACC de 64,3% y un AUC de 0,620 (Figura 2A; Tabla suplementaria S2), lo que logró una puntuación 5,8% más alta que LR en AUC.

A continuación, se calculó la importancia relativa de una variable para segregar a pacientes metastásicos de los no metastásicos para Cforest (Figura 2B). Identificamos los ocho factores principales, incluyendo SCC, IB2, IB1, MONO%, diámetro, PT(A), HCT y TT, como predictores importantes de Cforest para distinguir a pacientes metastásicos de los no metastásicos. Debe tenerse en cuenta que a medida que avanza la etapa clínica, SCC y el diámetro del tumor pueden aumentar.

Gráficos de caja estándar que presentan la distribución de cada variable entre muestras metastásicas y no metastásicas se muestran en la Figura 2C.

Resultó interesante que encontramos que SCC era una variable crítica. Desde la matriz de confusión (Figura 2D), las predicciones de RF tenían 105 muestras falsas negativas y 13 muestras falsas positivas. Sin embargo, las predicciones designadas como de mayor confianza (>0,2 bits del cálculo de ganancia de información de Shannon) contenían solo 29 malas predicciones de 230 instancias (Figura 3E). En particular, para las predicciones con mayor confianza, si un paciente fue predicho como no metastásico, esto fue correcto a una tasa de 1 29/230 = 87,4%.
## chunk 0015
hash: a2d919b636d939ee9006846dd2f496efdce3c4f9

**Original:**

22, 29 9620Curr. Oncol. 2022, 29, FOR PEER REVIEW 8

Figure 2. Differentiation of lymph node metastasis of cervical cancer with machine learning meth-

ods. (A) ROC curves derived from logistic regression for predicting lymph node metastasis of cer-

vical cancer based on all 75 peripheral blood markers using machine learning methods compared

with logistic regression. (B) Relative importance of variables for prediction of lymph node metasta-

sis calculated in the Cforest. Variable importance is represented as a percentage of the highest value.

Figure 2. Differentiation of lymph node metastasis of cervical cancer with machine learning methods.

(A) ROC curves derived from logistic regression for predicting lymph node metastasis of cervical

cancer based on all 75 peripheral blood markers using machine learning methods compared with

Curr. Oncol. 2022, 29 9621

logistic regression. (B) Relative importance of variables for prediction of lymph node metastasis calcu-

lated in the Cforest. Variable importance is represented as a percentage of the highest value. (C) Box

and jitter plots representing the distribution of top eight important parameters for distinguishing

metastasis from non-metastasis. (D,E), Confusion matrix indicating the prediction quality of the

Cforest classification for all predictions (D) and for those predictions with high (>0.2 bits) confidence

(E). Notes: SCC, squamous cell carcinoma antigen; MONO%, percentage of monocytes; PT(A), plasma

**Traducción:**

22, 29 9620Curr. Oncol. 2022, 29, PARA REVISIÓN POR PARES 8

Figura 2. Diferenciación de metástasis de ganglios linfáticos de cáncer de cuello uterino con métodos de aprendizaje automático. (A) Curvas ROC derivadas de regresión logística para predecir metástasis de ganglios linfáticos de cáncer de cuello uterino basado en todos los 75 marcadores de sangre periférica utilizando métodos de aprendizaje automático en comparación con regresión logística. (B) Importancia relativa de variables para la predicción de metástasis de ganglios linfáticos calculada en el Cforest. La importancia de la variable se representa como un porcentaje del valor más alto.

Figura 2. Diferenciación de metástasis de ganglios linfáticos de cáncer de cuello uterino con métodos de aprendizaje automático. (A) Curvas ROC derivadas de regresión logística para predecir metástasis de ganglios linfáticos de cáncer de cuello uterino basado en todos los 75 marcadores de sangre periférica utilizando métodos de aprendizaje automático en comparación con regresión logística. 

Curr. Oncol. 2022, 29 9621

logística. (B) Importancia relativa de variables para la predicción de metástasis de ganglios linfáticos calculada en el Cforest. La importancia de la variable se representa como un porcentaje del valor más alto. (C) Gráficos de caja y trama que representan la distribución de los ocho parámetros más importantes para distinguir metástasis de no metástasis. (D,E), Matriz de confusión que indica la calidad de la predicción de la clasificación Cforest para todas las predicciones (D) y para aquellas predicciones con alta (>0,2 bits) confianza (E). Notas: SCC, antígeno de carcinoma de células escamosas; MONO%, porcentaje de monocitos; PT(A), plasma
## chunk 0016
hash: 17f05f735238d9a9e7f94e6c767f1a8ae2024216

**Original:**

or those predictions with high (>0.2 bits) confidence

(E). Notes: SCC, squamous cell carcinoma antigen; MONO%, percentage of monocytes; PT(A), plasma

prothrombin time ratio (A); HCT, hematocrit; TT, thrombin time; LDH, lactate dehydrogenase; D-D,

D-dimer; PT(r), plasma prothrombin time ratio (r); HGB, hemoglobin; ALP, alkaline phosphatase;

TP, total protein; URIC, uric acid; neut%, percentage of neutrophils; b1-G, beta 1 globulin; CK-MB,

creatine kinase-MB isoenzyme; IgA, immunoglobulin A.

3.3. Prediction of Lymph-Vascular Space Invasion of Cervical Cancer Based on Preoperative Blood

Markers Using Machine Learning Methods

In the task of lymph-vascular space invasion, patients were labeled as “invasion” or

“non-invasion”. LVSI refers to the presence of epithelial tumor cells in the lumen of vessels.

“Invasion” indicated positive pathologic findings of LVSI and “non-invasion” indicated no

pathologic proof of LVSI. We found that EN showed the best prediction performance, with

ACC of 59.7% and AUC of 0.628, and the traditional method of multiple logistic regression

analysis was comparative with ACC of 59.5% and AUC of 0.627 (Figure 3A; Supplemental

Table S2).

Next, the relative importance of each variable for segregating invasion from non-

invasion was calculated for EN (Figure 3B). We identified the top eight factors, including

RDW-SD, CK-MB, PCT, A/G, PT(A), IB1, TT and TBIL, as important EN predictors for

**Traducción:**

Para aquellas predicciones con alta (>0.2 bits) confianza

(E). Notas: SCC, antígeno de carcinoma de células escamosas; MONO%, porcentaje de monocitos; PT(A), razón de tiempo de protrombina plasmática (A); HCT, hematocrito; TT, tiempo de trombina; LDH, lactato deshidrogenasa; D-D, dímero D; PT(r), razón de tiempo de protrombina plasmática (r); HGB, hemoglobina; ALP, fosfatasa alcalina; TP, proteína total; URIC, ácido úrico; neut%, porcentaje de neutrófilos; b1-G, globulina beta 1; CK-MB, isoenzima creatina quinasa-MB; IgA, inmunoglobulina A.

3.3. Predicción de la invasión del espacio linfático-vascular del cáncer de cuello uterino basada en marcadores sanguíneos preoperatorios utilizando métodos de aprendizaje automático

En la tarea de invasión del espacio linfático-vascular, los pacientes fueron etiquetados como "invasión" o "no invasión". LVSI se refiere a la presencia de células tumorales epiteliales en el lumen de los vasos. "Invasión" indicó hallazgos patológicos positivos de LVSI y "no invasión" indicó no haber prueba patológica de LVSI. Encontramos que EN mostró el mejor rendimiento de predicción, con una precisión del 59,7% y un área bajo la curva (AUC) de 0,628, y el método tradicional de análisis de regresión logística múltiple fue comparable con una precisión del 59,5% y un AUC de 0,627 (Figura 3A; Tabla suplementaria S2).

A continuación, se calculó la importancia relativa de cada variable para segregar la invasión de la no invasión para EN (Figura 3B). Identificamos los ocho factores principales, incluyendo RDW-SD, CK-MB, PCT, A/G, PT(A), IB1, TT y TBIL, como predictores importantes de EN para
## chunk 0017
hash: 867679eff342ba9e4f9f69869156fe45dbd7dd23

**Original:**

d for EN (Figure 3B). We identified the top eight factors, including

RDW-SD, CK-MB, PCT, A/G, PT(A), IB1, TT and TBIL, as important EN predictors for

distinguishing invasion patients from non-invasion ones. Standard box plots that present

the distribution of each variable between invasion and non-invasion are shown in Figure 3C.

Interestingly, we found that RDW-SD was a critical variable. From the confusion matrix

(Figure 3D), EN predictions had 180 false negative samples and 36 false positive samples.

However, predictions designated as higher confidence (>0.2 bits from Shannon information

gain computation) contained only 15 misprediction out of 98 instances (Figure 3D,E). In

particular, for the predictions with higher confidence, if a patient was predicted as non-

invasion, it was right at a rate of 1 15/98 = 84.7%.

Curr. Oncol. 2022, 29 9622Curr. Oncol. 2022, 29, FOR PEER REVIEW 10

Figure 3. Prediction of lymph-vascular space invasion of cervical cancer based on preoperative

blood markers using machine learning methods. (A) ROC curves derived from logistic regression

for predicting lymph-vascular space invasion of cervical cancer based on all 75 peripheral blood

markers using machine learning methods compared with logistic regression. (B) Relative im-

portance of variables for prediction of lymph-vascular space invasion calculated in the EN. Variable

Figure 3. Prediction of lymph-vascular space invasion of cervical cancer based on preoperative

**Traducción:**

d para EN (Figura 3B). Identificamos los ocho factores principales, incluyendo RDW-SD, CK-MB, PCT, A/G, PT(A), IB1, TT y TBIL, como predictores importantes de EN para distinguir a los pacientes con invasión de los que no la tienen. Las gráficas de caja estándar que presentan la distribución de cada variable entre invasión y no invasión se muestran en la Figura 3C.

Resultó interesante que encontramos que RDW-SD fue una variable crítica. A partir de la matriz de confusión (Figura 3D), las predicciones de EN tuvieron 180 muestras falsas negativas y 36 muestras falsas positivas. Sin embargo, las predicciones designadas como de mayor confianza (>0,2 bits del cálculo de ganancia de información de Shannon) contenían solo 15 predicciones incorrectas de 98 instancias (Figura 3D, E). En particular, para las predicciones con mayor confianza, si un paciente fue predicho como no invasión, fue correcto a una tasa de 15/98 = 84,7%.

Curr. Oncol. 2022, 29 9622Curr. Oncol. 2022, 29, PARA REVISIÓN POR PARES 10

Figura 3. Predicción de la invasión del espacio linfático vascular del cáncer de cuello uterino basada en marcadores sanguíneos preoperatorios utilizando métodos de aprendizaje automático. (A) Curvas ROC derivadas de la regresión logística para predecir la invasión del espacio linfático vascular del cáncer de cuello uterino basada en todos los 75 marcadores sanguíneos periféricos utilizando métodos de aprendizaje automático en comparación con la regresión logística. (B) Importancia relativa de las variables para la predicción de la invasión del espacio linfático vascular calculada en la EN. Variable 

Figura 3. Predicción de la invasión del espacio linfático vascular del cáncer de cuello uterino basada en marcadores sanguíneos preoperatorios
## chunk 0018
hash: 0056ad3751988409d18bde21e6915bee36633728

**Original:**

vascular space invasion calculated in the EN. Variable

Figure 3. Prediction of lymph-vascular space invasion of cervical cancer based on preoperative

blood markers using machine learning methods. (A) ROC curves derived from logistic regression for

predicting lymph-vascular space invasion of cervical cancer based on all 75 peripheral blood markers

Curr. Oncol. 2022, 29 9623

using machine learning methods compared with logistic regression. (B) Relative importance of

variables for prediction of lymph-vascular space invasion calculated in the EN. Variable importance

is represented as a percentage of the highest value. (C) Box and jitter plots representing the distri-

bution of top eight important blood markers for distinguishing invasion from non-invasion. (D,E)

Confusion matrix indicating the prediction quality of the EN classification for all predictions (D) and

for those predictions with high (>0.2 bits) confidence (E). Notes: RDW-SD, standard deviation of

red blood cell distribution width; CK-MB, creatine kinase-MB isoenzyme; PCT, plateletcrit; A/G,

albumin to globulin ratio; PT(A), plasma prothrombin time ratio (A); TT, thrombin time; TBIL, total

bilirubin; TP, total protein; TBA, total bile acid; MCV, mean corpuscular volume; abdo_surgery_0.0,

previous abdominal surgery; MONO%, percentage of monocytes; LDL-CHO, low density lipoprotein

cholesterol; D-D, D-dimer; b2-MG, beta 2 microglobulin.

4. Discussion

**Traducción:**

invasión del espacio vascular calculada en la EN. Variable

Figura 3. Predicción de la invasión del espacio linfático-vascular del cáncer de cuello uterino basada en marcadores sanguíneos preoperatorios utilizando métodos de aprendizaje automático. (A) Curvas ROC derivadas de la regresión logística para predecir la invasión del espacio linfático-vascular del cáncer de cuello uterino basada en todos los 75 marcadores sanguíneos periféricos

Curr. Oncol. 2022, 29 9623

utilizando métodos de aprendizaje automático en comparación con la regresión logística. (B) Importancia relativa de las variables para la predicción de la invasión del espacio linfático-vascular calculada en la EN. La importancia de las variables se representa como un porcentaje del valor más alto. (C) Gráficos de caja y jitter que representan la distribución de los ocho marcadores sanguíneos más importantes para distinguir la invasión de la no invasión. (D, E) Matriz de confusión que indica la calidad de la predicción de la clasificación de la EN para todas las predicciones (D) y para aquellas predicciones con alta confianza (> 0,2 bits) (E). Notas: RDW-SD, desviación estándar de la distribución del ancho de los glóbulos rojos; CK-MB, isoenzima creatina quinasa-MB; PCT, platelecrito; A/G, relación albúmina/globulina; PT(A), relación del tiempo de protrombina plasmática (A); TT, tiempo de trombina; TBIL, bilirrubina total; TP, proteína total; TBA, ácido biliar total; MCV, volumen corpuscular medio; abdo_surgery_0.0, cirugía abdominal previa; MONO%, porcentaje de monocitos; LDL-CHO, colesterol de lipoproteína de baja densidad; D-D, dímero D; b2-MG, beta 2 microglobulina.

4. Discusión
## chunk 0019
hash: 2a2c733b6db8cfe9d111cfeebd344eaa4c9370b7

**Original:**

inal surgery; MONO%, percentage of monocytes; LDL-CHO, low density lipoprotein

cholesterol; D-D, D-dimer; b2-MG, beta 2 microglobulin.

4. Discussion

In recent years, machine learning algorithms based on AI technology have been widely

accepted and extensively utilized for diagnostic and prognostic assessment of various types

of cancers in the context of precision medicine [11,21,22]. This innovative approach, serving

as an important tool with high accuracy and efficient ability to process complex data, can

explore the key related factors to effectively assist in the clinical decision making of cervi-

cal cancer treatment. More importantly, hidden and embedded patterns within familiar

clinical data can be revealed with the aid of AI models. However, so far, no studies have

been conducted on integrating readily accessible clinical blood markers into the model

construction of predicting pathologic risk factors in cervical cancer based on AI technology.

Our study allowed for the comparison of various machine learning algorithms with the

traditional logistic regression analysis to identify the approach with the most favorable

performance and explore the serologic biomarkers with potential diagnostic potency. In

cervical cancer with FIGO stage IB-IIA, radical hysterectomy followed by tailored adju-

vant radiotherapy and concurrent chemoradiotherapy are both recommended for suitable

treatment modalities [21]. Postoperative adjuvant radiotherapy is warranted for women

**Traducción:**

cirugía inal; MONO%, porcentaje de monocitos; LDL-CHO, colesterol de lipoproteína de baja densidad; D-D, dímero D; b2-MG, beta 2 microglobulina.

4. Discusión

En los últimos años, los algoritmos de aprendizaje automático basados en la tecnología de inteligencia artificial han sido ampliamente aceptados y utilizados extensivamente para la evaluación diagnóstica y pronóstica de varios tipos de cáncer en el contexto de la medicina de precisión [11,21,22]. Este enfoque innovador, que sirve como una herramienta importante con alta precisión y capacidad eficiente para procesar datos complejos, puede explorar los factores clave relacionados para asistir eficazmente en la toma de decisiones clínicas del tratamiento del cáncer cervical. Más importante aún, los patrones ocultos y embebidos dentro de los datos clínicos familiares pueden ser revelados con la ayuda de los modelos de inteligencia artificial. Sin embargo, hasta ahora, no se han realizado estudios sobre la integración de marcadores sanguíneos clínicos de fácil acceso en la construcción del modelo para predecir factores de riesgo patológico en el cáncer cervical basado en la tecnología de inteligencia artificial. Nuestro estudio permitió comparar varios algoritmos de aprendizaje automático con el análisis de regresión logística tradicional para identificar el enfoque con el desempeño más favorable y explorar los biomarcadores serológicos con potencialidad diagnóstica. En el cáncer cervical con estadio IB-IIA de la FIGO, la histerectomía radical seguida de radioterapia adyuvante personalizada y quimiorradioterapia concurrente son ambas recomendadas como modalidades de tratamiento adecuadas [21]. La radioterapia adyuvante postoperatoria está indicada para las mujeres
## chunk 0020
hash: f6b5c4dc14fbcb23ba94d5ddc070a45360ee584c

**Original:**

 concurrent chemoradiotherapy are both recommended for suitable

treatment modalities [21]. Postoperative adjuvant radiotherapy is warranted for women

with histopathologically verified risk factors, such as LVSI, LNM, DSI, etc., to improve

prognosis [22–24], which led to an increase in the risk of higher morbidity [25–27]. It is

beneficial and meaningful to predict pathologic risk factors so as to identify those more

likely to receive postoperative adjuvant radiotherapy to avoid compounding treatment-

related morbidity. Currently, the lack of ability to accurately identify those with a higher

chance to receive postoperative radiotherapy and achieve individualized medical man-

agement instead of a “one-size fits all” approach has been a primary clinical limitation.

Therefore, predicting pathologic risk factors by comprehensive utility of laboratory blood

tests and other pretreatment information is a fundamental way toward individualized

optimal medical care. In this study, we explored the ability of multiple machine learning

methods to predict pathologic risk factors of patients with cervical cancer by incorporating

readily available blood biomarkers. We found that three ensemble classifiers, RF, Cforest

and EN, were able to predict pathologic risk factors of early-stage cervical cancer, in which

RF showed the best predictive performance with an appreciable accuracy of 70.8% and

**Traducción:**

La quimiorradioterapia concurrente son ambas recomendadas para modalidades de tratamiento adecuadas [21]. La radioterapia adyuvante postoperatoria está indicada para mujeres con factores de riesgo verificados histopatológicamente, como LVSI, LNM, DSI, etc., para mejorar el pronóstico [22–24], lo que llevó a un aumento en el riesgo de mayor morbilidad [25–27]. Es beneficioso y significativo predecir factores de riesgo patológicos para identificar a aquellos que son más propensos a recibir radioterapia adyuvante postoperatoria y evitar así la morbilidad relacionada con el tratamiento. Actualmente, la falta de capacidad para identificar con precisión a aquellos con una mayor probabilidad de recibir radioterapia postoperatoria y lograr un manejo médico individualizado en lugar de un enfoque de "talla única" ha sido una limitación clínica principal. Por lo tanto, predecir factores de riesgo patológicos mediante la utilización integral de pruebas de sangre de laboratorio y otra información de pretreatment es una forma fundamental hacia la atención médica óptima individualizada. En este estudio, exploramos la capacidad de múltiples métodos de aprendizaje automático para predecir factores de riesgo patológicos de pacientes con cáncer de cuello uterino mediante la incorporación de biomarcadores sanguíneos fácilmente disponibles. Encontramos que tres clasificadores de conjunto, RF, Cforest y EN, fueron capaces de predecir factores de riesgo patológicos de cáncer de cuello uterino en etapa temprana, en el que RF mostró el mejor desempeño predictivo con una precisión apreciable del 70,8% y
## chunk 0021
hash: 670a8f596411a21ff69fa74ec3481ac51e123d06

**Original:**

 pathologic risk factors of early-stage cervical cancer, in which

RF showed the best predictive performance with an appreciable accuracy of 70.8% and

AUC of 0.767 for DSI. Cforest showed the most accurate predictive value for LNM (64.3%

accuracy and 0.620 AUC), and EN for LVSI (59.7% accuracy and 0.628 AUC). Compared to

the traditional approach of logistic regression analysis, the RF classifier achieved a 5.4%

higher score of AUC in DSI prediction, Cforest achieved a 3.4% higher score of AUC in

LNM prediction and EN showed almost the same performance in LVSI prediction. The

underperformance of these classifiers with regard to LNM and LVSI may be attributable to

the lack of particularly strong distinctions of cervical cancer at the level of an early stage

based on serum biomarkers. Nevertheless, the results indicate that AI technology can pro-

vide valuable predictive information before primary treatment to facilitate individualized

medical strategy. In addition, based on the optimal results of machine learning algorithms,

this study may offer useful clinical information concerning variables that are of most

importance for identification of pathologic risk factors, like DSI, in early-stage patients.

Curr. Oncol. 2022, 29 9624

Previous evidence has suggested that cancer is a metabolic disease associated with in-

flammation [28]. Cervical cancer harbors a unique collection of inflammatory and metabolic

**Traducción:**

factores de riesgo patológico del cáncer de cuello uterino en etapa temprana, en el que 

RF mostró el mejor desempeño predictivo con una precisión apreciable del 70,8% y 

AUC de 0,767 para DSI. Cforest mostró el valor predictivo más preciso para LNM (64,3% 

de precisión y 0,620 AUC), y EN para LVSI (59,7% de precisión y 0,628 AUC). En comparación 

con el enfoque tradicional del análisis de regresión logística, el clasificador RF logró una puntuación 

5,4% más alta de AUC en la predicción de DSI, Cforest logró una puntuación 3,4% más alta de AUC 

en la predicción de LNM y EN mostró un desempeño casi igual en la predicción de LVSI. El 

desempeño deficiente de estos clasificadores con respecto a LNM y LVSI puede ser atribuible a 

la falta de distinciones particularmente fuertes del cáncer de cuello uterino a nivel de etapa temprana 

basado en biomarcadores séricos. Sin embargo, los resultados indican que la tecnología de inteligencia 

artificial puede proporcionar información predictiva valiosa antes del tratamiento primario para 

facilitar la estrategia médica individualizada. Además, basado en los resultados óptimos de los algoritmos 

de aprendizaje automático, este estudio puede ofrecer información clínica útil sobre las variables que 

son de mayor importancia para la identificación de factores de riesgo patológico, como DSI, en pacientes 

en etapa temprana. Curr. Oncol. 2022, 29 9624

La evidencia previa ha sugerido que el cáncer es una enfermedad metabólica asociada con inflamación [28]. 

El cáncer de cuello uterino alberga una colección única de inflamación y metabolismo
## chunk 0022
hash: bc5e332c442fe5190f77a5a13b8adc0e6b94cf1d

**Original:**

ted that cancer is a metabolic disease associated with in-

flammation [28]. Cervical cancer harbors a unique collection of inflammatory and metabolic

molecules in the serum [29]. In early-stage cervical cancer, local inflammatory processes

may be at an initial state in which the peritumoral microenvironment perhaps alters the

most, while distant and systemic metabolic features and cancer-target responses are im-

munosuppressed [30], leading to the slight distinction of cancer invasiveness, which was

obscured in serum markers. Understandably, as tumor debulk progresses, tumor burden

aggravates, leading to cancer invasiveness. In this study, we found that squamous cell

carcinoma antigen (SCC), D-dimer and uric acid (UA) levels were the top five significant

plasma biomarkers for predicting DSI. SCC has been considered as the most important

diagnostic and prognostic tumor marker in cervical cancer. Many studies demonstrated

that an elevated level of pretreatment serum SCC was closely associated with disease

progression and recurrence [31,32]. UA is a powerful antioxidant and considered as a

protective factor against cancer [33]. It has been reported that an elevated level of UA

was associated with cancer risk, aggressiveness and poor oncologic outcomes in various

cancer types [34–36], but few studies have focused on gynecologic cancer. Interestingly,

previous studies have also shown a prooxidant role of UA [37] and lower levels of UA were

**Traducción:**

se ha demostrado que el cáncer es una enfermedad metabólica asociada con inflamación [28]. El cáncer cervical alberga una colección única de moléculas inflamatorias y metabólicas en el suero [29]. En el cáncer cervical en etapa temprana, los procesos inflamatorios locales pueden estar en un estado inicial en el que el microentorno peritumoral tal vez se altere más, mientras que las características metabólicas sistémicas y las respuestas a la cáncer dirigidas están inmunosuprimidas [30], lo que lleva a una ligera distinción de la invasividad del cáncer, que se oscureció en los marcadores séricos. Comprensiblemente, a medida que progresa la reducción del tumor, la carga tumoral se agrava, lo que lleva a la invasividad del cáncer. En este estudio, encontramos que los niveles de antígeno de carcinoma de células escamosas (SCC), D-dímero y ácido úrico (AU) fueron los cinco biomarcadores plasmáticos más significativos para predecir la DSI. El SCC se ha considerado como el marcador tumoral más importante para el diagnóstico y la prognosis en el cáncer cervical. Muchos estudios han demostrado que un nivel elevado de SCC sérico antes del tratamiento se asoció estrechamente con la progresión y la recurrencia de la enfermedad [31,32]. El AU es un poderoso antioxidante y se considera un factor protector contra el cáncer [33]. Se ha informado que un nivel elevado de AU se asoció con el riesgo de cáncer, la agresividad y los resultados oncológicos pobres en varios tipos de cáncer [34–36], pero pocos estudios se han centrado en el cáncer ginecológico. Curiosamente, estudios anteriores también han mostrado un papel prooxidante del AU [37] y niveles más bajos de AU se asociaron con una mayor supervivencia en pacientes con cáncer.
## chunk 0023
hash: 096b3c5c49bd905f577aa591c736f7179eb65a0f

**Original:**

 studies have focused on gynecologic cancer. Interestingly,

previous studies have also shown a prooxidant role of UA [37] and lower levels of UA were

associated with elevated risk of cancer-related mortality compared with high levels [38].

The precise relation of UA with cancer, especially cervical cancer, needs further study.

D-dimer serves as a valuable marker of activation of coagulation and fibrinolysis, and is

also known as a biomarker of cancer prognosis, especially in metastasized patients [39–41].

The pretreatment prediction model of DSI in cervical cancer performed well and revealed

potential meaningful serum biomarkers that were readily available in clinical settings,

which is also consistent with previous studies. This study’s findings suggest that the

supervised machine learning analysis serves as a feasible and effective approach that can

aid in discovering more meaningful biomarkers that are correlated with PRF in cervical

cancer and are not identified by conventional multiple regression analysis.

Identification of reliable pretreatment blood markers associated with pathologic risk

factors helps clinicians in clinical decision making [42]. In this study, we found some

serologic indicators, such as RDW-SD and other indicators, that had scarcely been found

to be related to the diagnosis and prognosis of cervical cancer in previous studies. We

found that RDW was the top predictive indicator for LVSI. RDW is a routinely measured

**Traducción:**

Los estudios se han centrado en el cáncer ginecológico. Curiosamente, 

estudios previos también han demostrado un papel prooxidante de la UA [37] y niveles más bajos de UA se asociaron con un mayor riesgo de mortalidad relacionada con el cáncer en comparación con niveles altos [38]. 

La relación precisa de la UA con el cáncer, especialmente el cáncer cervical, necesita más estudio. 

El D-dímero sirve como un marcador valioso de la activación de la coagulación y la fibrinólisis, y también es conocido como un biomarcador de la prognosis del cáncer, especialmente en pacientes metastatizados [39–41]. 

El modelo de predicción de tratamiento previo de DSI en el cáncer cervical funcionó bien y reveló posibles biomarcadores séricos significativos que estaban fácilmente disponibles en la práctica clínica, 

lo que también es consistente con estudios previos. Los hallazgos de este estudio sugieren que el análisis de aprendizaje automático supervisado sirve como un enfoque factible y efectivo que puede ayudar a descubrir biomarcadores más significativos que se correlacionan con la FRP en el cáncer cervical y que no se identifican mediante el análisis de regresión múltiple convencional. 

La identificación de marcadores sanguíneos de tratamiento previo confiables asociados con factores de riesgo patológicos ayuda a los clínicos en la toma de decisiones clínicas [42]. En este estudio, encontramos algunos indicadores serológicos, como la RDW-SD y otros indicadores, que apenas se habían encontrado relacionados con el diagnóstico y la prognosis del cáncer cervical en estudios previos. 

Encontramos que la RDW fue el indicador predictivo principal para la IVLS. La RDW es una medición de rutina
## chunk 0024
hash: 426535c21d0715dbd5f38b05f9f5f98c68cfe243

**Original:**

gnosis and prognosis of cervical cancer in previous studies. We

found that RDW was the top predictive indicator for LVSI. RDW is a routinely measured

hematological index, primarily reflecting the degree of anisocytosis. It has been reported

that this simple and inexpensive parameter is a strong and independent risk factor for

death in the general population [43]. Research has demonstrated that an aberrant elevation

level of RDW leads to poor survival outcomes in most tumor types and stages, independent

of age, gender or region [44]. However, little is known about RDW in cervical cancer.

One recent study indicated that RDW was associated with worse prognosis in cervical

cancer [45]. Excessive oxidative stress, inflammation, and cell senescence were proposed as

the conditions that RDW associates closely with mortality [46,47]. More dataset analysis is

still needed to confirm the predictive ability of these factors. Based on the high efficiency of

pretreatment blood markers, the dynamic detection of serological indicators in multiple

time periods may be more powerful in prediction. As the dynamic analysis of serological

indicators is more complex, future studies should develop the use of artificial intelligence-

based machine learning algorithms to identify the predictive features of preoperative

blood variable time series, which might significantly facilitate the accuracy of clinical

characteristics prediction and deserve further study.

**Traducción:**

gnosis y pronóstico del cáncer cervical en estudios previos. Encontramos que el RDW fue el indicador predictivo principal para la invasión de los vasos linfáticos (LVSI). El RDW es un índice hematológico medido rutinariamente, que refleja principalmente el grado de anisocitosis. Se ha reportado que este parámetro simple y económico es un factor de riesgo fuerte y independiente para la muerte en la población en general [43]. La investigación ha demostrado que un nivel elevado anormal de RDW conduce a resultados de supervivencia pobres en la mayoría de los tipos y etapas de tumores, independientemente de la edad, el género o la región [44]. Sin embargo, se sabe poco sobre el RDW en el cáncer cervical. Un estudio reciente indicó que el RDW se asoció con un peor pronóstico en el cáncer cervical [45]. Se propusieron el estrés oxidativo excesivo, la inflamación y la senescencia celular como las condiciones que el RDW se asocia estrechamente con la mortalidad [46,47]. Todavía se necesita más análisis de conjuntos de datos para confirmar la capacidad predictiva de estos factores. Basado en la alta eficiencia de los marcadores sanguíneos de pretamiento, la detección dinámica de indicadores serológicos en múltiples períodos de tiempo puede ser más poderosa en la predicción. Como el análisis dinámico de indicadores serológicos es más complejo, los estudios futuros deberían desarrollar el uso de algoritmos de aprendizaje automático basados en inteligencia artificial para identificar las características predictivas de las series de tiempo de variables sanguíneas preoperatorias, lo que podría facilitar significativamente la precisión de la predicción de las características clínicas y merece más estudio.
## chunk 0025
hash: 573c57884842605cad777583c38e6ca1ae63fa65

**Original:**

tive

blood variable time series, which might significantly facilitate the accuracy of clinical

characteristics prediction and deserve further study.

As tumors progress over time, the signal transduction and correlation between

the tumor and its microenvironment, including fibroblasts, tumor-related immune cells

and endothelial cells, will become increasingly closer [48]. The changes of peripheral

blood parameters before surgery were inherently a combination of tumor-specific and

microenvironment-specific factors and the result of the interaction between tumor and mi-

croenvironment. Given the importance of tumor microenvironment in the process of tumor

development, clinicians should make full use of preoperative peripheral blood indicators

Curr. Oncol. 2022, 29 9625

for treatment decision making, cancer progression evaluation and prognosis assessment. In

previous studies, clinicians often ignored the reflection of regular blood biomarkers on the

biological characteristics of tumors and relied almost exclusively on tumor-specific factors

as included indicators for assessment, which was also a common problem in previous

retrospective analysis of tumors. In this study, we identified a series of blood indicators that

were readily available and necessary for preoperative evaluation related to pathologic risk

factors by machine learning methods, such as UA, D-dimer, thrombin time, AST, MONO%,

**Traducción:**

teníamos

series de tiempo de variables sanguíneas, lo que podría facilitar significativamente la precisión de la predicción de características clínicas y merece un estudio más a fondo.

A medida que los tumores progresan con el tiempo, la transducción de señales y la correlación entre el tumor y su microentorno, incluyendo fibroblastos, células inmunes relacionadas con el tumor y células endoteliales, se volverán cada vez más estrechas [48]. Los cambios en los parámetros de sangre periférica antes de la cirugía fueron inherentemente una combinación de factores específicos del tumor y factores específicos del microentorno y el resultado de la interacción entre el tumor y el microentorno. Dada la importancia del microentorno del tumor en el proceso de desarrollo del tumor, los clínicos deben aprovechar al máximo los indicadores de sangre periférica preoperatorios

Curr. Oncol. 2022, 29 9625

para la toma de decisiones de tratamiento, la evaluación de la progresión del cáncer y la evaluación de la prognosis. En estudios anteriores, los clínicos a menudo ignoraron la reflexión de los biomarcadores sanguíneos regulares sobre las características biológicas de los tumores y se basaron casi exclusivamente en factores específicos del tumor como indicadores incluidos para la evaluación, lo que también fue un problema común en el análisis retrospectivo anterior de los tumores. En este estudio, identificamos una serie de indicadores sanguíneos que estaban fácilmente disponibles y necesarios para la evaluación preoperatoria relacionada con factores de riesgo patológicos mediante métodos de aprendizaje automático, como UA, D-dímero, tiempo de trombina, AST, MONO%,
## chunk 0026
hash: ab0906bf14a0ad8d1bda13dcfde1b080a9268d22

**Original:**

necessary for preoperative evaluation related to pathologic risk

factors by machine learning methods, such as UA, D-dimer, thrombin time, AST, MONO%,

RDW-SD, etc. These parameters have the potential to be related to the microenvironment

in cancer progression or metastasis, and their changes will also influence treatment timing

and selection.

There have been a few previous studies exploring the use of serologic biomarkers to

predict PRF. One study [49] in 2016 incorporated clinical factors and three blood markers

derived from pretreatment blood routine examination to predict LNM, patients’ overall

survival and recurrence-free survival. They found platelet/lymphocyte ratio were signifi-

cantly associated with LNM. Another study [50] in 2020 found that pretreatment albumin

to fibrinogen ratio was significantly related to lymph node metastasis, depth of stromal

infiltration, etc. Many studies focused on prediction for survival outcomes or a single PRF

of cervical cancer based on clinical factors [51–53] and/or radiomic parameters [54,55].

However, no studies have made an attempt to predict three PRFs based on a series of

clinically readily available blood markers. In addition to critical data analysis methods

based on clinical factors, there are still many studies exploring new approaches of post-

operative pathologic risk factors prediction. It is clear that the diagnosis of pathologic

**Traducción:**

necesario para la evaluación preoperatoria relacionada con factores de riesgo patológico 

mediante métodos de aprendizaje automático, como la urea (UA), el dímero D, el tiempo de trombina, la AST, el porcentaje de monocitos (MONO%), 

la desviación estándar de la distribución de la red celular (RDW-SD), etc. Estos parámetros tienen el potencial de estar relacionados con el microentorno 

en la progresión o metástasis del cáncer, y sus cambios también influirán en la elección y el momento del tratamiento.

Ha habido algunos estudios previos que exploran el uso de biomarcadores serológicos para 

predecir el factor de riesgo patológico (PRF). Un estudio [49] en 2016 incorporó factores clínicos y tres marcadores sanguíneos derivados de la prueba de sangre de rutina pretratamiento para predecir la metástasis a los ganglios linfáticos (LNM), la supervivencia general de los pacientes y la supervivencia libre de recurrencia. Encontraron que la relación entre plaquetas y linfocitos estaba significativamente asociada con LNM. Otro estudio [50] en 2020 encontró que la relación entre albúmina y fibrinógeno pretratamiento estaba significativamente relacionada con la metástasis a los ganglios linfáticos, la profundidad de la infiltración estromal, etc. Muchos estudios se centraron en la predicción de resultados de supervivencia o un solo PRF del cáncer cervical basado en factores clínicos [51–53] y/o parámetros radiómicos [54,55]. 

Sin embargo, no hay estudios que hayan intentado predecir tres PRF basados en una serie de marcadores sanguíneos fácilmente disponibles en la clínica. Además de los métodos críticos de análisis de datos basados en factores clínicos, todavía hay muchos estudios que exploran nuevos enfoques para la predicción de factores de riesgo patológico postoperatorio. Está claro que el diagnóstico de factores de riesgo patológico
## chunk 0027
hash: 54e53c2b74a561139801269cf9af5febe430e6e3

**Original:**

e are still many studies exploring new approaches of post-

operative pathologic risk factors prediction. It is clear that the diagnosis of pathologic

risk factors could only be accurately judged from the postoperative report of cervical can-

cer. Identification of reliable approaches that are able to predict pathologic risk factors

in advance would facilitate the identification of more accurate diagnostic stratification

and a more appropriate treatment strategy. A previous study indicated that DSI can be

determined by combining the 2D or 3D ultrasound with clinical variables before treatment,

with over 70% accuracy and AUC [56]. However, this diagnostic approach depended more

on subjective judgment rather than objective parameters based on relatively few cases. It

was reported that the assessment of cervical cancer with full-thickness stromal invasion by

MRI examination was limited [57]. In Bidus’s study, the conical method combined with

clinical factors to determine DSI and LVSI before treatment also achieved good accuracy

but this method is a destructive examination and may easily interfere with the complete

resection of radical surgery [58]. In the study of LNM diagnosis, sentinel node staining is

currently the most commonly developed method, but it is only used to determine whether

complete lymph node resection is performed before surgery [59,60]. In this study, LNM

was associated closely with primary tumor size as staging and tumor diameter were among

**Traducción:**

Aún existen muchos estudios que exploran nuevos enfoques para la predicción de factores de riesgo patológico postoperatorio. Está claro que el diagnóstico de factores de riesgo patológico solo puede ser juzgado con precisión a partir del informe postoperatorio del cáncer cervical. La identificación de enfoques confiables que puedan predecir factores de riesgo patológico con anticipación facilitaría la identificación de una estratificación diagnóstica más precisa y una estrategia de tratamiento más adecuada. Un estudio previo indicó que el DSI puede ser determinado combinando la ecografía 2D o 3D con variables clínicas antes del tratamiento, con una precisión superior al 70% y un AUC [56]. Sin embargo, este enfoque diagnóstico dependió más del juicio subjetivo que de parámetros objetivos basados en relativamente pocos casos. Se informó que la evaluación del cáncer cervical con invasión estromal de grosor total mediante examen de MRI estaba limitada [57]. En el estudio de Bidus, el método conico combinado con factores clínicos para determinar el DSI y el LVSI antes del tratamiento también logró una buena precisión, pero este método es un examen destructivo y puede interferir fácilmente con la resección completa de la cirugía radical [58]. En el estudio del diagnóstico de LNM, la tinción del ganglio centinela es actualmente el método más comúnmente desarrollado, pero solo se utiliza para determinar si se realiza la resección completa de los ganglios linfáticos antes de la cirugía [59,60]. En este estudio, la LNM estuvo estrechamente asociada con el tamaño del tumor primario como estadificación y el diámetro del tumor fueron entre
## chunk 0028
hash: d57f2860620112cf1091b571ec24949a043dd75c

**Original:**

ction is performed before surgery [59,60]. In this study, LNM

was associated closely with primary tumor size as staging and tumor diameter were among

the top five predictors for LNM. Results indicated that imaging materials, such as MRI,

reflecting the visual size of the tumor itself and enlarged lymph nodes would potentially

provide more accurate predictive information preoperatively. However, previous studies

also used magnetic resonance imaging (MRI) and ultrasound to determine lymph node

metastasis, but imaging data could only determine lymphadenectasis rather than tumor

cell metastases in most cases, which leads to the unsatisfactory accuracy of the prediction

model [56,61]. This is a reminder that traditional data analysis on simple integration of

imaging information is not adequate enough to achieve LNM prediction. It is promising

to achieve more comprehensive and precise prediction by virtue of effective integration

of high-throughput extraction of a large amount of information from images based on AI

technology, which will be the focus of our subsequent research. As the approach used

in this study did not consider any information from pretreatment biopsies or imaging

studies, there may be a limitation of the ability to predict pathologic risk factors before

initial treatment; indeed, more independent datasets from other institutions are required to

investigate how pretreatment blood signatures can be utilized for more accurate assessment

**Traducción:**

La acción se realiza antes de la cirugía [59,60]. En este estudio, LNM se asoció estrechamente con el tamaño del tumor primario, ya que la estadificación y el diámetro del tumor estuvieron entre los cinco predictores principales para LNM. Los resultados indicaron que los materiales de imagen, como la resonancia magnética (MRI), que reflejan el tamaño visual del tumor en sí y los ganglios linfáticos aumentados de tamaño, podrían proporcionar información predictiva más precisa preoperatoria. Sin embargo, estudios previos también utilizaron imágenes de resonancia magnética (MRI) y ultrasonido para determinar la metástasis de los ganglios linfáticos, pero los datos de imagen solo pudieron determinar la linfadenectasis en lugar de las metástasis de células tumorales en la mayoría de los casos, lo que lleva a la insatisfactoria precisión del modelo de predicción [56,61]. Esto es un recordatorio de que el análisis de datos tradicional sobre la integración simple de la información de imagen no es lo suficientemente adecuado como para lograr la predicción de LNM. Es prometedor lograr una predicción más completa y precisa mediante la integración efectiva de la extracción de alta velocidad de una gran cantidad de información de las imágenes basada en la tecnología de inteligencia artificial, lo que será el enfoque de nuestra investigación posterior. Como el enfoque utilizado en este estudio no consideró ninguna información de biopsias o estudios de imagen pretratamiento, puede haber una limitación en la capacidad de predecir factores de riesgo patológicos antes del tratamiento inicial; de hecho, se requieren más conjuntos de datos independientes de otras instituciones para investigar cómo las firmas sanguíneas pretratamiento pueden ser utilizadas para una evaluación más precisa
## chunk 0029
hash: 6b700a2ccf1d387ce5e8a7362dcbba8af5216b80

**Original:**

dependent datasets from other institutions are required to

investigate how pretreatment blood signatures can be utilized for more accurate assessment

of pathologic risk factors. Manipulation of high-throughput sequencing analysis, such as

RNA sequencing, of pretreatment peripheral blood may improve predictive performance,

Curr. Oncol. 2022, 29 9626

however, from another perspective, it may become more complicated and expensive to

incorporate RNA analysis information into the process of preoperative assessment in the

current context of clinical settings. Further comprehensive investigation is needed in the

hope of achieving the best clinical and socioeconomic benefits.

Our study has some limitations. Firstly, this study was a single-center retrospective

study. The retrospective nature may result in inherent bias. Secondly, results from our

database should be supplemented with external and prospective validation for prevention

of overfitting as well as further spread of application in clinical practice. Thirdly, other

machine learning approaches should be undertaken to manage the missing data in future

work. Fourthly, our assessment of diagnostic ability to predict pathological risk factors

was preliminary, and further study is warranted to better validate the accuracy of blood

biomarkers. At present, our model is not sufficiently powerful and accurate to predict LVSI

and LNM, but some blood biomarkers have been revealed for the first time that may be

**Traducción:**

se requieren conjuntos de datos dependientes de otras instituciones para 

investigar cómo las firmas sanguíneas de pretamento pueden ser utilizadas para una evaluación más precisa 

de los factores de riesgo patológico. La manipulación del análisis de secuenciación de alto rendimiento, como 

la secuenciación de ARN, de sangre periférica de pretamento puede mejorar el rendimiento predictivo, 

Curr. Oncol. 2022, 29 9626 

sin embargo, desde otra perspectiva, puede volverse más complicado y costoso incorporar la información del análisis de ARN en el proceso de evaluación preoperatoria en el 

contexto actual de la práctica clínica. Se necesita una investigación exhaustiva adicional con la esperanza de lograr los mejores beneficios clínicos y socioeconómicos. 

Nuestro estudio tiene algunas limitaciones. Primero, este estudio fue un estudio retrospectivo de un solo centro. La naturaleza retrospectiva puede resultar en un sesgo inherente. Segundo, los resultados de nuestra base de datos deben ser complementados con validación externa y prospectiva para prevenir el sobreajuste, así como una mayor difusión de la aplicación en la práctica clínica. Tercero, otros enfoques de aprendizaje automático deben ser emprendidos para gestionar los datos faltantes en trabajos futuros. Cuarto, nuestra evaluación de la capacidad de diagnóstico para predecir los factores de riesgo patológico fue preliminar, y se requiere un estudio adicional para validar mejor la precisión de los biomarcadores sanguíneos. En la actualidad, nuestro modelo no es lo suficientemente poderoso y preciso para predecir la invasión de la vaina linfática (LVSI) y los metastasis linfáticos (LNM), pero algunos biomarcadores sanguíneos han sido revelados por primera vez que pueden ser
## chunk 0031
hash: 5a984accc73e2048903b6cc13067faa19715327d

**Original:**

sources, D.Z. and B.L.; data curation, Z.O., W.M.,

S.L. and Y.Z.; writing—original draft preparation, Z.O. and W.M.; writing—review and editing, D.Z.

and W.M.; visualization, W.M.; supervision, D.Z.; project administration, D.Z. and B.L.; funding

acquisition, D.Z. All authors have read and agreed to the published version of the manuscript.

Funding: This research was funded by the National Natural Science Foundation of China (D.Z., grant

number 62176267), the Natural Science Foundation of Qinghai Province (D.Z., grant number 2021-ZJ-

922); the CAMS Innovation Fund for Medical Sciences (D.Z., grant number 2021-I2M-C&T-B-048), the

Beijing Hope Run Special Fund of Cancer Foundation of China (D.Z., grant number LC2021A10) and

Capital’s Funds for Health Improvement and Research (D.Z., grant number 2022-2-4026).

Institutional Review Board Statement: Ethical review and approval were waived for this study due

to the retrospective nature of the data.

Informed Consent Statement: Patient consent was waived due to the retrospective nature of

the study.

Data Availability Statement: The datasets used and/or analyzed during the current study are

available from the corresponding author on reasonable request.

Conflicts of Interest: The authors declare no conflict of interest. The funders had no role in the design

of the study; in the collection, analyses or interpretation of data; in the writing of the manuscript; or

in the decision to publish the results.

**Traducción:**

fuentes, D.Z. y B.L.; curación de datos, Z.O., W.M., S.L. y Y.Z.; redacción—preparación del borrador original, Z.O. y W.M.; redacción—revisión y edición, D.Z. y W.M.; visualización, W.M.; supervisión, D.Z.; administración del proyecto, D.Z. y B.L.; adquisición de financiamiento, D.Z. Todos los autores han leído y aceptado la versión publicada del manuscrito.

Financiamiento: Esta investigación fue financiada por la Fundación Nacional de Ciencias Naturales de China (D.Z., número de subvención 62176267), la Fundación de Ciencias Naturales de la Provincia de Qinghai (D.Z., número de subvención 2021-ZJ-922); el Fondo de Innovación de la CAMS para Ciencias Médicas (D.Z., número de subvención 2021-I2M-C&T-B-048), el Fondo Especial de la Fundación de Cáncer de China de la Carrera de la Esperanza de Pekín (D.Z., número de subvención LC2021A10) y los Fondos de la Capital para la Mejora y la Investigación de la Salud (D.Z., número de subvención 2022-2-4026).

Declaración del Comité de Revisión Institucional: La revisión y aprobación éticas fueron dispensadas para este estudio debido a la naturaleza retrospectiva de los datos.

Declaración de Consentimiento Informado: El consentimiento del paciente fue dispensado debido a la naturaleza retrospectiva del estudio.

Declaración de Disponibilidad de Datos: Los conjuntos de datos utilizados y/o analizados durante el estudio actual están disponibles del autor correspondiente bajo solicitud razonable.

Conflictos de Interés: Los autores declaran no tener conflicto de intereses. Los financiadores no tuvieron ningún papel en el diseño del estudio; en la recopilación, análisis o interpretación de los datos; en la redacción del manuscrito; o en la decisión de publicar los resultados.
## chunk 0030
hash: 2ece4654131c2466ef975e767d1cc2c1c60b0b27

**Original:**

 model is not sufficiently powerful and accurate to predict LVSI

and LNM, but some blood biomarkers have been revealed for the first time that may be

potentially useful predictors from a large number of variables. However, a positive predic-

tion is not trivial; compared with traditional methods, the machine learning algorithms

could serve as a feasible tool for clinicians to predict oncologic outcomes based solely on

pretherapeutic information.

5. Conclusions

This study indicates that AI-based algorithms are useful tools that may aid in providing

critical information for diagnostic evaluation of pathologic risk factors in patients with

cervical cancer before initial treatment. The use of predictive algorithms may facilitate

personalized treatment selection through pretherapeutic assessment.

Supplementary Materials: The following supporting information can be downloaded at: https:

//www.mdpi.com/article/10.3390/curroncol29120755/s1, Table S1: Pretreatment peripheral blood

tests of 1260 cervical cancer patients included in the primary cohort; Table S2: Diagnostic accuracy of

clinicopathological factors using machine learning algorithms.

Author Contributions: Conceptualization, D.Z., Y.Y. and B.L.; methodology, D.Z.; formal analysis,

Z.O.; investigation, Z.O., W.M., L.T., S.L. and Y.Z.; resources, D.Z. and B.L.; data curation, Z.O., W.M.,

S.L. and Y.Z.; writing—original draft preparation, Z.O. and W.M.; writing—review and editing, D.Z.

**Traducción:**

El modelo no es lo suficientemente poderoso y preciso para predecir la invasión de la estroma linfático (LVSI) y la metástasis a los ganglios linfáticos (LNM), pero algunos biomarcadores sanguíneos han sido revelados por primera vez que pueden ser predictores potencialmente útiles a partir de una gran cantidad de variables. Sin embargo, una predicción positiva no es trivial; en comparación con los métodos tradicionales, los algoritmos de aprendizaje automático podrían servir como una herramienta factible para los clínicos para predecir los resultados oncológicos basados únicamente en la información preterapéutica.

5. Conclusiones

Este estudio indica que los algoritmos basados en inteligencia artificial son herramientas útiles que pueden ayudar a proporcionar información crítica para la evaluación diagnóstica de factores de riesgo patológicos en pacientes con cáncer cervical antes del tratamiento inicial. El uso de algoritmos predictivos puede facilitar la selección de tratamiento personalizado a través de la evaluación preterapéutica.

Materiales suplementarios: La siguiente información de apoyo se puede descargar en: https://www.mdpi.com/article/10.3390/curroncol29120755/s1, Tabla S1: Pruebas de sangre periférica pretratamiento de 1260 pacientes con cáncer cervical incluidos en la cohorte principal; Tabla S2: Precisión diagnóstica de factores clinicopatológicos utilizando algoritmos de aprendizaje automático.

Contribuciones de los autores: Conceptualización, D.Z., Y.Y. y B.L.; metodología, D.Z.; análisis formal, Z.O.; investigación, Z.O., W.M., L.T., S.L. y Y.Z.; recursos, D.Z. y B.L.; curación de datos, Z.O., W.M., S.L. y Y.Z.; redacción - preparación del borrador original, Z.O. y W.M.; redacción - revisión y edición, D.Z.
## chunk 0032
hash: 310cc329a53726dfaa1972b7133c8678b08d181a

**Original:**

gn

of the study; in the collection, analyses or interpretation of data; in the writing of the manuscript; or

in the decision to publish the results.

Curr. Oncol. 2022, 29 9627

References

1. Bray, F.; Ferlay, J.; Soerjomataram, I.; Siegel, R.L.; Torre, L.A.; Jemal, A. Global cancer statistics 2018: GLOBOCAN estimates of

incidence and mortality worldwide for 36 cancers in 185 countries. CA Cancer J. Clin. 2018, 68, 394–424. [CrossRef] [PubMed]

2. Bhatla, N.; Aoki, D.; Sharma, D.N.; Sankaranarayanan, R. Cancer of the cervix uteri. Int. J. Gynaecol. Obstet. 2018, 143 (Suppl. 2),

22–36. [CrossRef] [PubMed]

3. Peng, Y.H.; Wang, X.X.; Zhu, J.S.; Gao, L. Neo-adjuvant chemotherapy plus surgery versus surgery alone for cervical cancer:

Meta-analysis of randomized controlled trials. J. Obstet. Gynaecol. Res. 2016, 42, 128–135. [CrossRef] [PubMed]

4. Landoni, F.; Colombo, A.; Milani, R.; Placa, F.; Zanagnolo, V.; Mangioni, C. Randomized study between radical surgery and

radiotherapy for the treatment of stage IB-IIA cervical cancer: 20-year update. J. Gynecol. Oncol. 2017, 28, e34. [CrossRef]

[PubMed]

5. Barter, J.F.; Soong, S.J.; Shingleton, H.M.; Hatch, K.D.; Orr, J.W., Jr. Complications of combined radical hysterectomy-postoperative

radiation therapy in women with early stage cervical cancer. Gynecol. Oncol. 1989, 32, 292–296. [CrossRef] [PubMed]

**Traducción:**

del estudio; en la recolección, análisis o interpretación de datos; en la redacción del manuscrito; o 

en la decisión de publicar los resultados.

Curr. Oncol. 2022, 29 9627

Referencias

1. Bray, F.; Ferlay, J.; Soerjomataram, I.; Siegel, R.L.; Torre, L.A.; Jemal, A. Estadísticas globales de cáncer 2018: estimaciones de GLOBOCAN de la incidencia y la mortalidad en todo el mundo para 36 cánceres en 185 países. CA Cancer J. Clin. 2018, 68, 394–424. [CrossRef] [PubMed]

2. Bhatla, N.; Aoki, D.; Sharma, D.N.; Sankaranarayanan, R. Cáncer del útero. Int. J. Gynaecol. Obstet. 2018, 143 (Suppl. 2), 22–36. [CrossRef] [PubMed]

3. Peng, Y.H.; Wang, X.X.; Zhu, J.S.; Gao, L. Quimioterapia neoadyuvante más cirugía versus cirugía sola para el cáncer cervical: metanálisis de ensayos clínicos controlados aleatorizados. J. Obstet. Gynaecol. Res. 2016, 42, 128–135. [CrossRef] [PubMed]

4. Landoni, F.; Colombo, A.; Milani, R.; Placa, F.; Zanagnolo, V.; Mangioni, C. Estudio aleatorizado entre cirugía radical y radioterapia para el tratamiento del cáncer cervical en estadio IB-IIA: actualización a 20 años. J. Gynecol. Oncol. 2017, 28, e34. [CrossRef] [PubMed]

5. Barter, J.F.; Soong, S.J.; Shingleton, H.M.; Hatch, K.D.; Orr, J.W., Jr. Complicaciones de la histerectomía radical combinada con radioterapia postoperatoria en mujeres con cáncer cervical en estadio temprano. Gynecol. Oncol. 1989, 32, 292–296. [CrossRef] [PubMed]
## chunk 0033
hash: e1fa2c14b770fc6d68c7ba9d4dfd7e6a2565003e

**Original:**

adical hysterectomy-postoperative

radiation therapy in women with early stage cervical cancer. Gynecol. Oncol. 1989, 32, 292–296. [CrossRef] [PubMed]

6. Ayhan, A.; Al, R.A.; Baykal, C.; Demirtas, E.; Ayhan, A.; Yüce, K. Prognostic factors in FIGO stage IB cervical cancer without

lymph node metastasis and the role of adjuvant radiotherapy after radical hysterectomy. Int. J. Gynecol. Cancer 2004, 14, 286–292.

[CrossRef]

7. Kim, D.Y.; Shim, S.H.; Kim, S.O.; Lee, S.W.; Park, J.Y.; Suh, D.S.; Kim, J.H.; Kim, Y.M.; Kim, Y.T.; Nam, J.H. Preoperative nomogram

for the identification of lymph node metastasis in early cervical cancer. Br. J. Cancer 2014, 110, 34–41. [CrossRef]

8. Hutchcraft, M.L.; Smith, B.; McLaughlin, E.M.; Hade, E.M.; Backes, F.J.; O’Malley, D.M.; Cohn, D.E.; Fowler, J.M.; Copeland, L.J.;

Salani, R. Conization pathologic features as a predictor of intermediate and high risk features on radical hysterectomy specimens

in early stage cervical cancer. Gynecol. Oncol. 2019, 153, 255–258. [CrossRef]

9. Li, X.; Zhou, J.; Huang, K.; Tang, F.; Zhou, H.; Wang, S.; Jia, Y.; Sun, H.; Ma, D.; Li, S. The predictive value of serum squamous

cell carcinoma antigen in patients with cervical cancer who receive neoadjuvant chemotherapy followed by radical surgery: A

single-institute study. PLoS ONE 2015, 10, e0122361. [CrossRef]

10. Obrzut, B.; Kusy, M.; Semczuk, A.; Obrzut, M.; Kluska, J. Prediction of 5-year overall survival in cervical cancer patients treated

**Traducción:**

histerectomía radical postoperatoria 

terapia de radiación en mujeres con cáncer cervical en etapa temprana. Gynecol. Oncol. 1989, 32, 292–296. [CrossRef] [PubMed]

6. Ayhan, A.; Al, R.A.; Baykal, C.; Demirtas, E.; Ayhan, A.; Yüce, K. Factores pronósticos en cáncer cervical en etapa IB de la FIGO sin 
metástasis en los ganglios linfáticos y el papel de la radioterapia adyuvante después de la histerectomía radical. Int. J. Gynecol. Cancer 2004, 14, 286–292.

[CrossRef]

7. Kim, D.Y.; Shim, S.H.; Kim, S.O.; Lee, S.W.; Park, J.Y.; Suh, D.S.; Kim, J.H.; Kim, Y.M.; Kim, Y.T.; Nam, J.H. Nomograma preoperatorio 
para la identificación de metástasis en los ganglios linfáticos en cáncer cervical temprano. Br. J. Cancer 2014, 110, 34–41. [CrossRef]

8. Hutchcraft, M.L.; Smith, B.; McLaughlin, E.M.; Hade, E.M.; Backes, F.J.; O’Malley, D.M.; Cohn, D.E.; Fowler, J.M.; Copeland, L.J.; 
Salani, R. Características patológicas de la conización como predictor de características de riesgo intermedio y alto en especímenes de histerectomía radical en cáncer cervical en etapa temprana. Gynecol. Oncol. 2019, 153, 255–258. [CrossRef]

9. Li, X.; Zhou, J.; Huang, K.; Tang, F.; Zhou, H.; Wang, S.; Jia, Y.; Sun, H.; Ma, D.; Li, S. El valor predictivo del antígeno del carcinoma de células escamosas en suero en pacientes con cáncer cervical que reciben quimioterapia neoadyuvante seguida de cirugía radical: Un estudio de un solo instituto. PLoS ONE 2015, 10, e0122361. [CrossRef]

10. Obrzut, B.; Kusy, M.; Semczuk, A.; Obrzut, M.; Kluska, J. Predicción de la supervivencia general de 5 años en pacientes con cáncer cervical tratados
## chunk 0034
hash: 009f301d7abee6a6d1e343b89b30f4f7d1a32fe0

**Original:**

1. [CrossRef]

10. Obrzut, B.; Kusy, M.; Semczuk, A.; Obrzut, M.; Kluska, J. Prediction of 5-year overall survival in cervical cancer patients treated

with radical hysterectomy using computational intelligence methods. BMC Cancer 2017, 17, 840. [CrossRef]

11. Matsuo, K.; Purushotham, S.; Jiang, B.; Mandelbaum, R.S.; Takiuchi, T.; Liu, Y.; Roman, L.D. Survival outcome prediction in

cervical cancer: Cox models vs deep-learning model. Am. J. Obstet. Gynecol. 2019, 220, 381.e1–381.e14. [CrossRef]

12. Papadia, A.; Bellati, F.; Bogani, G.; Ditto, A.; Martinelli, F.; Lorusso, D.; Donfrancesco, C.; Gasparri, M.L.; Raspagliesi, F. When

Does Neoadjuvant Chemotherapy Really Avoid Radiotherapy? Clinical Predictors of Adjuvant Radiotherapy in Cervical Cancer.

Ann. Surg. Oncol. 2015, 22 (Suppl. 3), S944–S951. [CrossRef]

13. Friedman, J.H. Greedy function approximation: A gradient boosting machine. Ann. Stat. 2001, 29, 1189–1232. [CrossRef]

14. Natekin, A.; Knoll, A. Gradient boosting machines, a tutorial. Front. Neurorobot. 2013, 7, 21. [CrossRef]

15. Cortes, C.; Vapnik, V. Support-Vector Networks. Mach. Learn. 1995, 20, 273–297. [CrossRef]

16. Breiman, L. Random forests. Mach. Learn. 2001, 45, 5–32. [CrossRef]

17. Liu, L.; Chen, L.; Zhang, K.; Liusan, N.; Yang, Z. Conditional Random Forest Based Smiling Face Detector, Has Random Forest

Smile Classification Module for Detecting Dynamic Smiling Face Classifying Random Forest Non-Classification Face Area of

**Traducción:**

1. [CrossRef]

10. Obrzut, B.; Kusy, M.; Semczuk, A.; Obrzut, M.; Kluska, J. Predicción de la supervivencia general a 5 años en pacientes con cáncer de cuello uterino tratados con histerectomía radical utilizando métodos de inteligencia computacional. BMC Cancer 2017, 17, 840. [CrossRef]

11. Matsuo, K.; Purushotham, S.; Jiang, B.; Mandelbaum, R.S.; Takiuchi, T.; Liu, Y.; Roman, L.D. Predicción del resultado de supervivencia en cáncer de cuello uterino: modelos de Cox vs modelo de aprendizaje profundo. Am. J. Obstet. Gynecol. 2019, 220, 381.e1–381.e14. [CrossRef]

12. Papadia, A.; Bellati, F.; Bogani, G.; Ditto, A.; Martinelli, F.; Lorusso, D.; Donfrancesco, C.; Gasparri, M.L.; Raspagliesi, F. ¿Cuándo la quimioterapia neoadyuvante realmente evita la radioterapia? Predictores clínicos de radioterapia adyuvante en cáncer de cuello uterino. Ann. Surg. Oncol. 2015, 22 (Suppl. 3), S944–S951. [CrossRef]

13. Friedman, J.H. Aproximación de función codiciosa: una máquina de impulso de gradiente. Ann. Stat. 2001, 29, 1189–1232. [CrossRef]

14. Natekin, A.; Knoll, A. Máquinas de impulso de gradiente, un tutorial. Front. Neurorobot. 2013, 7, 21. [CrossRef]

15. Cortes, C.; Vapnik, V. Redes de soporte de vector. Mach. Learn. 1995, 20, 273–297. [CrossRef]

16. Breiman, L. Bosques aleatorios. Mach. Learn. 2001, 45, 5–32. [CrossRef]

17. Liu, L.; Chen, L.; Zhang, K.; Liusan, N.; Yang, Z. Detector de cara sonriente basado en bosque aleatorio condicional, tiene módulo de clasificación de sonrisa de bosque aleatorio para detectar cara sonriente dinámica, clasificación de bosque aleatorio no clasificación de área de cara no clasificada
## chunk 0035
hash: 23623586a0de1a46c29db0dbc0b809ace9dabc00

**Original:**

 Detector, Has Random Forest

Smile Classification Module for Detecting Dynamic Smiling Face Classifying Random Forest Non-Classification Face Area of

Smiling Face. China Patent CN106650637-A, 10 May 2017.

18. Dv, L. Fiducial distributions and Bayes’ theorem. J. R. Stat. Soc. 1958, 1, 102–107.

19. Zou, H.; Hastie, T. Regularization and variable selection via the elastic net. J. R. Stat. Soc. 2005, 67, 301–320. [CrossRef]

20. Feutrill, A.; Roughan, M. A Review of Shannon and Differential Entropy Rate Estimation. Entropy 2021, 23, 1046. [CrossRef]

21. Bhatla, N.; Aoki, D.; Sharma, D.N.; Sankaranarayanan, R. Cancer of the cervix uteri: 2021 update. Int. J. Gynecol. Obstet. 2021, 155,

28–44. [CrossRef]

22. Sedlis, A.; Bundy, B.N.; Rotman, M.Z.; Lentz, S.S.; Muderspach, L.I.; Zaino, R.J. A randomized trial of pelvic radiation therapy

versus no further therapy in selected patients with stage IB carcinoma of the cervix after radical hysterectomy and pelvic

lymphadenectomy: A Gynecologic Oncology Group Study. Gynecol. Oncol. 1999, 73, 177–183. [CrossRef] [PubMed]

23. Pieterse, Q.D.; Trimbos, J.B.M.Z.; Dijkman, A.; Creutzberg, C.L.; Gaarenstroom, K.N.; Peters, A.A.W.; Kenter, G.G. Postoperative

radiation therapy improves prognosis in patients with adverse risk factors in localized, early-stage cervical cancer: A retrospective

comparative study. Int. J. Gynecol. Cancer 2006, 16, 1112–1118. [CrossRef] [PubMed]

**Traducción:**

Detector, Bosque Aleatorio

Módulo de Clasificación de Sonrisa para Detectar Sonrisa Dinámica Clasificando Bosque Aleatorio No-Clasificación Área de la Cara Sonriente.

Cara Sonriente. Patente China CN106650637-A, 10 de mayo de 2017.

18. Dv, L. Distribuciones fiduciarias y teorema de Bayes. J. R. Stat. Soc. 1958, 1, 102–107.

19. Zou, H.; Hastie, T. Regularización y selección de variables a través de la red elástica. J. R. Stat. Soc. 2005, 67, 301–320. [CrossRef]

20. Feutrill, A.; Roughan, M. Revisión de la estimación de la tasa de entropía de Shannon y diferencial. Entropía 2021, 23, 1046. [CrossRef]

21. Bhatla, N.; Aoki, D.; Sharma, D.N.; Sankaranarayanan, R. Cáncer del cuello uterino: actualización 2021. Int. J. Gynecol. Obstet. 2021, 155, 28–44. [CrossRef]

22. Sedlis, A.; Bundy, B.N.; Rotman, M.Z.; Lentz, S.S.; Muderspach, L.I.; Zaino, R.J. Ensayo aleatorizado de radioterapia pélvica versus no más tratamiento en pacientes seleccionados con carcinoma de estadio IB del cuello uterino después de histerectomía radical y linfadenectomía pélvica: Un estudio del Grupo de Oncología Ginecológica. Gynecol. Oncol. 1999, 73, 177–183. [CrossRef] [PubMed]

23. Pieterse, Q.D.; Trimbos, J.B.M.Z.; Dijkman, A.; Creutzberg, C.L.; Gaarenstroom, K.N.; Peters, A.A.W.; Kenter, G.G. La radioterapia postoperatoria mejora el pronóstico en pacientes con factores de riesgo adversos en cáncer cervical localizado en estadio temprano: Un estudio comparativo retrospectivo. Int. J. Gynecol. Cancer 2006, 16, 1112–1118. [CrossRef] [PubMed]
## chunk 0036
hash: f94e854da2950ce679a840e0ade6c4d147b7f0a9

**Original:**

actors in localized, early-stage cervical cancer: A retrospective

comparative study. Int. J. Gynecol. Cancer 2006, 16, 1112–1118. [CrossRef] [PubMed]

24. Ryu, S.-Y.; Park, S.-I.; Nam, B.-H.; Cho, C.-K.; Kim, K.; Kim, B.-J.; Kim, M.-H.; Choi, S.-C.; Lee, E.-D.; Lee, K.-H. Is adjuvant

chemoradiotherapy overtreatment in cervical cancer patients with intermediate risk factors? Int. J. Radiat. Oncol. Biol. Phys. 2011,

79, 794–799. [CrossRef] [PubMed]

25. Peters, W.A.; Liu, P.Y.; Barrett, R.J.; Stock, R.J.; Monk, B.J.; Berek, J.S.; Souhami, L.; Grigsby, P.; Gordon, W.; Alberts, D.S. Concurrent

Chemotherapy and Pelvic Radiation Therapy Compared With Pelvic Radiation Therapy Alone as Adjuvant Therapy After Radical

Surgery in High-Risk Early-Stage Cancer of the Cervix. J. Clin. Oncol. 2000, 18, 1606–1613. [CrossRef] [PubMed]

26. Landoni, F.; Maneo, A.; Colombo, A.; Placa, F.; Milani, R.; Perego, P.; Favini, G.; Ferri, L.; Mangioni, C. Randomised study of

radical surgery versus radiotherapy for stage Ib-IIa cervical cancer. Lancet 1997, 350, 535–540. [CrossRef]

27. Kong, T.-W.; Lee, J.-D.; Son, J.-H.; Paek, J.; Chun, M.; Chang, S.-J.; Ryu, H.-S. Treatment outcomes in patients with FIGO stage

IB–IIA cervical cancer and a focally disrupted cervical stromal ring on magnetic resonance imaging: A propensity score matching

study. Gynecol. Oncol. 2016, 143, 77–82. [CrossRef]

Curr. Oncol. 2022, 29 9628

**Traducción:**

actores en el cáncer cervical en etapa temprana y localizado: Un estudio retrospectivo comparativo. Int. J. Gynecol. Cancer 2006, 16, 1112–1118. [CrossRef] [PubMed]

24. Ryu, S.-Y.; Park, S.-I.; Nam, B.-H.; Cho, C.-K.; Kim, K.; Kim, B.-J.; Kim, M.-H.; Choi, S.-C.; Lee, E.-D.; Lee, K.-H. ¿Es la quimiorradioterapia adyuvante un tratamiento excesivo en pacientes con cáncer cervical y factores de riesgo intermedio? Int. J. Radiat. Oncol. Biol. Phys. 2011, 79, 794–799. [CrossRef] [PubMed]

25. Peters, W.A.; Liu, P.Y.; Barrett, R.J.; Stock, R.J.; Monk, B.J.; Berek, J.S.; Souhami, L.; Grigsby, P.; Gordon, W.; Alberts, D.S. Quimioterapia concurrente y radioterapia pélvica comparadas con radioterapia pélvica sola como terapia adyuvante después de cirugía radical en cáncer de cuello uterino en etapa temprana de alto riesgo. J. Clin. Oncol. 2000, 18, 1606–1613. [CrossRef] [PubMed]

26. Landoni, F.; Maneo, A.; Colombo, A.; Placa, F.; Milani, R.; Perego, P.; Favini, G.; Ferri, L.; Mangioni, C. Estudio aleatorizado de cirugía radical versus radioterapia para cáncer cervical en estadio Ib-IIa. Lancet 1997, 350, 535–540. [CrossRef]

27. Kong, T.-W.; Lee, J.-D.; Son, J.-H.; Paek, J.; Chun, M.; Chang, S.-J.; Ryu, H.-S. Resultados del tratamiento en pacientes con cáncer cervical en estadio IB–IIA de la FIGO y un anillo estromal cervical disrupto de manera focal en imágenes de resonancia magnética: Un estudio de emparejamiento de puntuación de propensión. Gynecol. Oncol. 2016, 143, 77–82. [CrossRef]

Curr. Oncol. 2022, 29 9628
## chunk 0037
hash: effe90877b78c9f7520ac57fefe52252033e4e69

**Original:**

romal ring on magnetic resonance imaging: A propensity score matching

study. Gynecol. Oncol. 2016, 143, 77–82. [CrossRef]

Curr. Oncol. 2022, 29 9628

28. Wishart, D.S.; Mandal, R.; Stanislaus, A.; Ramirez-Gaona, M. Cancer Metabolomics and the Human Metabolome Database.

Metabolites 2016, 6, 10. [CrossRef]

29. Yang, K.; Xia, B.; Wang, W.; Cheng, J.; Yin, M.; Xie, H.; Li, J.; Ma, L.; Yang, C.; Li, A.; et al. A Comprehensive Analysis of

Metabolomics and Transcriptomics in Cervical Cancer. Sci. Rep. 2017, 7, 43353. [CrossRef]

30. Yuan, Y.; Cai, X.; Shen, F.; Ma, F. HPV post-infection microenvironment and cervical cancer. Cancer Lett. 2021, 497, 243–254.

[CrossRef]

31. Charakorn, C.; Thadanipon, K.; Chaijindaratana, S.; Rattanasiri, S.; Numthavaj, P.; Thakkinstian, A. The association between

serum squamous cell carcinoma antigen and recurrence and survival of patients with cervical squamous cell carcinoma: A

systematic review and meta-analysis. Gynecol. Oncol. 2018, 150, 190–200. [CrossRef]

32. Choi, K.H.; Lee, S.W.; Yu, M.; Jeong, S.; Lee, J.W.; Lee, J.H. Significance of elevated SCC-Ag level on tumor recurrence and patient

survival in patients with squamous-cell carcinoma of uterine cervix following definitive chemoradiotherapy: A multi-institutional

analysis. J. Gynecol. Oncol. 2019, 30, e1. [CrossRef]

33. Ames, B.N.; Cathcart, R.; Schwiers, E.; Hochstein, P. Uric acid provides an antioxidant defense in humans against oxidant- and

**Traducción:**

anillo de Romal en imágenes de resonancia magnética: un estudio de emparejamiento de puntuación de propensión. Gynecol. Oncol. 2016, 143, 77–82. [CrossRef]

Curr. Oncol. 2022, 29 9628

28. Wishart, D.S.; Mandal, R.; Stanislaus, A.; Ramirez-Gaona, M. Metabolómica del cáncer y la base de datos del metaboloma humano.

Metabolites 2016, 6, 10. [CrossRef]

29. Yang, K.; Xia, B.; Wang, W.; Cheng, J.; Yin, M.; Xie, H.; Li, J.; Ma, L.; Yang, C.; Li, A.; et al. Un análisis integral de metabolómica y transcriptómica en el cáncer cervical. Sci. Rep. 2017, 7, 43353. [CrossRef]

30. Yuan, Y.; Cai, X.; Shen, F.; Ma, F. Microentorno postinfección por VPH y cáncer cervical. Cancer Lett. 2021, 497, 243–254. [CrossRef]

31. Charakorn, C.; Thadanipon, K.; Chaijindaratana, S.; Rattanasiri, S.; Numthavaj, P.; Thakkinstian, A. La asociación entre el antígeno de células escamosas y la recurrencia y supervivencia de pacientes con carcinoma de células escamosas cervicales: una revisión sistemática y metanálisis. Gynecol. Oncol. 2018, 150, 190–200. [CrossRef]

32. Choi, K.H.; Lee, S.W.; Yu, M.; Jeong, S.; Lee, J.W.; Lee, J.H. Importancia del nivel elevado de SCC-Ag en la recurrencia del tumor y la supervivencia del paciente en pacientes con carcinoma de células escamosas de cuello uterino después de quimiorradioterapia definitiva: un análisis multiinstitucional. J. Gynecol. Oncol. 2019, 30, e1. [CrossRef]

33. Ames, B.N.; Cathcart, R.; Schwiers, E.; Hochstein, P. El ácido úrico proporciona una defensa antioxidante en humanos contra oxidantes y
## chunk 0038
hash: d0c0ee12df7d42464f598ac2fb6f0273fea149f7

**Original:**

30, e1. [CrossRef]

33. Ames, B.N.; Cathcart, R.; Schwiers, E.; Hochstein, P. Uric acid provides an antioxidant defense in humans against oxidant- and

radical-caused aging and cancer: A hypothesis. Proc. Natl. Acad. Sci. USA 1981, 78, 6858–6862. [CrossRef]

34. Xu, Y.; Wu, Z.; Ye, W.; Xiao, Y.; Zheng, W.; Chen, Q.; Bai, P.; Lin, Z.; Chen, C. Prognostic value of serum uric acid and tumor

response to induction chemotherapy in locally advanced nasopharyngeal carcinoma. BMC Cancer 2021, 21, 519. [CrossRef]

35. Hayashi, M.; Yamada, S.; Tanabe, H.; Takami, H.; Inokawa, Y.; Sonohara, F.; Shimizu, D.; Hattori, N.; Kanda, M.; Tanaka, C.; et al.

High Serum Uric Acid Levels Could Be a Risk Factor of Hepatocellular Carcinoma Recurrences. Nutr. Cancer 2021, 73, 996–1003.

[CrossRef]

36. Yan, S.; Zhang, P.; Xu, W.; Liu, Y.; Wang, B.; Jiang, T.; Hua, C.; Wang, X.; Xu, D.; Sun, B. Serum Uric Acid Increases Risk of Cancer

Incidence and Mortality: A Systematic Review and Meta-Analysis. Mediat. Inflamm. 2015, 2015, 764250. [CrossRef]

37. Kang, D.H.; Ha, S.K. Uric Acid Puzzle: Dual Role as Anti-oxidantand Pro-oxidant. Electrolyte Blood Press. 2014, 12, 1–6. [CrossRef]

38. Kuo, C.F.; See, L.C.; Yu, K.H.; Chou, I.J.; Chiou, M.J.; Luo, S.F. Significance of serum uric acid levels on the risk of all-cause and

cardiovascular mortality. Rheumatology 2013, 52, 127–134. [CrossRef]

**Traducción:**

30, e1. [CrossRef]

33. Ames, B.N.; Cathcart, R.; Schwiers, E.; Hochstein, P. El ácido úrico proporciona una defensa antioxidante en humanos contra el envejecimiento y el cáncer causados por oxidantes y radicales: Una hipótesis. Proc. Natl. Acad. Sci. USA 1981, 78, 6858–6862. [CrossRef]

34. Xu, Y.; Wu, Z.; Ye, W.; Xiao, Y.; Zheng, W.; Chen, Q.; Bai, P.; Lin, Z.; Chen, C. Valor pronóstico del ácido úrico sérico y la respuesta tumoral a la quimioterapia de inducción en el carcinoma nasofaríngeo localmente avanzado. BMC Cancer 2021, 21, 519. [CrossRef]

35. Hayashi, M.; Yamada, S.; Tanabe, H.; Takami, H.; Inokawa, Y.; Sonohara, F.; Shimizu, D.; Hattori, N.; Kanda, M.; Tanaka, C.; et al. Niveles altos de ácido úrico sérico podrían ser un factor de riesgo de recurrencias del carcinoma hepatocelular. Nutr. Cancer 2021, 73, 996–1003. [CrossRef]

36. Yan, S.; Zhang, P.; Xu, W.; Liu, Y.; Wang, B.; Jiang, T.; Hua, C.; Wang, X.; Xu, D.; Sun, B. El ácido úrico sérico aumenta el riesgo de incidencia y mortalidad por cáncer: Una revisión sistemática y metanálisis. Mediat. Inflamm. 2015, 2015, 764250. [CrossRef]

37. Kang, D.H.; Ha, S.K. El rompecabezas del ácido úrico: Doble papel como antioxidante y prooxidante. Electrolyte Blood Press. 2014, 12, 1–6. [CrossRef]

38. Kuo, C.F.; See, L.C.; Yu, K.H.; Chou, I.J.; Chiou, M.J.; Luo, S.F. Importancia de los niveles de ácido úrico sérico en el riesgo de mortalidad por todas las causas y cardiovascular. Rheumatology 2013, 52, 127–134. [CrossRef]
## chunk 0039
hash: cfcb0c421394e535c42113364fdbfdba3adc915e

**Original:**

.; Luo, S.F. Significance of serum uric acid levels on the risk of all-cause and

cardiovascular mortality. Rheumatology 2013, 52, 127–134. [CrossRef]

39. Watanabe, A.; Araki, K.; Harimoto, N.; Kubo, N.; Igarashi, T.; Ishii, N.; Yamanaka, T.; Hagiwara, K.; Kuwano, H.; Shirabe, K.

D-dimer predicts postoperative recurrence and prognosis in patients with liver metastasis of colorectal cancer. Int. J. Clin. Oncol.

2018, 23, 689–697. [CrossRef]

40. Kim, E.Y.; Song, K.Y. Prognostic value of D-dimer levels in patients with gastric cancer undergoing gastrectomy. Surg. Oncol.

2021, 37, 101570. [CrossRef]

41. Lin, Y.; Liu, Z.; Qiu, Y.; Zhang, J.; Wu, H.; Liang, R.; Chen, G.; Qin, G.; Li, Y.; Zou, D. Clinical significance of plasma D-dimer and

fibrinogen in digestive cancer: A systematic review and meta-analysis. Eur. J. Surg. Oncol. 2018, 44, 1494–1503. [CrossRef]

42. Ma, J.Y.; Ke, L.C.; Liu, Q. The pretreatment platelet-to-lymphocyte ratio predicts clinical outcomes in patients with cervical cancer:

A meta-analysis. Medicine 2018, 97, e12897. [CrossRef] [PubMed]

43. Montagnana, M.; Danese, E. Red cell distribution width and cancer. Ann. Transl. Med. 2016, 4, 399. [CrossRef] [PubMed]

44. Wang, P.F.; Song, S.Y.; Guo, H.; Wang, T.J.; Liu, N.; Yan, C.X. Prognostic role of pretreatment red blood cell distribution width in

patients with cancer: A meta-analysis of 49 studies. J. Cancer 2019, 10, 4305–4317. [CrossRef] [PubMed]

**Traducción:**

Luo, S.F. Importancia de los niveles de ácido úrico sérico en el riesgo de mortalidad por todas las causas y cardiovascular. Reumatología 2013, 52, 127–134. [CrossRef]

39. Watanabe, A.; Araki, K; Harimoto, N; Kubo, N; Igarashi, T; Ishii, N; Yamanaka, T; Hagiwara, K; Kuwano, H; Shirabe, K. 
El D-dímero predice la recurrencia postoperatoria y el pronóstico en pacientes con metástasis hepática de cáncer colorrectal. Oncología Clínica Internacional 2018, 23, 689–697. [CrossRef]

40. Kim, EY; Song, KY. Valor pronóstico de los niveles de D-dímero en pacientes con cáncer gástrico sometidos a gastrectomía. Oncología Quirúrgica 2021, 37, 101570. [CrossRef]

41. Lin, Y; Liu, Z; Qiu, Y; Zhang, J; Wu, H; Liang, R; Chen, G; Qin, G; Li, Y; Zou, D. Importancia clínica del D-dímero plasmático y la fibrinogenina en el cáncer digestivo: Una revisión sistemática y metanálisis. Oncología Quirúrgica Europea 2018, 44, 1494–1503. [CrossRef]

42. Ma, JY; Ke, LC; Liu, Q. La relación plaquetas-linfocitos antes del tratamiento predice los resultados clínicos en pacientes con cáncer cervical: Un metanálisis. Medicina 2018, 97, e12897. [CrossRef] [PubMed]

43. Montagnana, M; Danese, E. Ancho de distribución de los glóbulos rojos y cáncer. Medicina de Traducción 2016, 4, 399. [CrossRef] [PubMed]

44. Wang, PF; Song, SY; Guo, H; Wang, TJ; Liu, N; Yan, CX. Papel pronóstico del ancho de distribución de los glóbulos rojos antes del tratamiento en pacientes con cáncer: Un metanálisis de 49 estudios. Revista de Cáncer 2019, 10, 4305–4317. [CrossRef] [PubMed]
## chunk 0040
hash: 110fdd22e42671808efcd3491575dbd95b1a9a3b

**Original:**

reatment red blood cell distribution width in

patients with cancer: A meta-analysis of 49 studies. J. Cancer 2019, 10, 4305–4317. [CrossRef] [PubMed]

45. Lima, P.S.V.d.; Mantoani, P.T.S.; Murta, E.F.C.; Nomelini, R.S. Laboratory parameters as predictors of prognosis in uterine cervical

neoplasia. Eur. J. Obstet. Gynecol. Reprod. Biol. 2021, 256, 391–396. [CrossRef]

46. Salvagno, G.L.; Sanchis-Gomar, F.; Picanza, A.; Lippi, G. Red blood cell distribution width: A simple parameter with multiple

clinical applications. Crit. Rev. Clin. Lab. Sci. 2015, 52, 86–105. [CrossRef] [PubMed]

47. Pan, J.; Borné, Y.; Engström, G. The relationship between red cell distribution width and all-cause and cause-specific mortality in

a general population. Sci. Rep. 2019, 9, 16208. [CrossRef]

48. Whiteside, T.L. The tumor microenvironment and its role in promoting tumor growth. Oncogene 2008, 27, 5904–5912. [CrossRef]

49. Chen, L.; Zhang, F.; Sheng, X.G.; Zhang, S.Q.; Chen, Y.T.; Liu, B.W. Peripheral platelet/lymphocyte ratio predicts lymph node

metastasis and acts as a superior prognostic factor for cervical cancer when combined with neutrophil: Lymphocyte. Medicine

2016, 95, e4381. [CrossRef]

50. Huang, L.; Mo, Z.; Zhang, L.; Qin, S.; Qin, S.; Li, S. Diagnostic Value of Albumin to Fibrinogen Ratio in Cervical Cancer. Int. J.

Biol. Markers 2020, 35, 66–73. [CrossRef]

**Traducción:**

Ancho de distribución de los glóbulos rojos en el tratamiento de pacientes con cáncer: Un metaanálisis de 49 estudios. J. Cancer 2019, 10, 4305–4317. [CrossRef] [PubMed]

45. Lima, P.S.V.d.; Mantoani, P.T.S.; Murta, E.F.C.; Nomelini, R.S. Parámetros de laboratorio como predictores de pronóstico en neoplasia cervical uterina. Eur. J. Obstet. Gynecol. Reprod. Biol. 2021, 256, 391–396. [CrossRef]

46. Salvagno, G.L.; Sanchis-Gomar, F.; Picanza, A.; Lippi, G. Ancho de distribución de los glóbulos rojos: Un parámetro simple con múltiples aplicaciones clínicas. Crit. Rev. Clin. Lab. Sci. 2015, 52, 86–105. [CrossRef] [PubMed]

47. Pan, J.; Borné, Y.; Engström, G. La relación entre el ancho de distribución de los glóbulos rojos y la mortalidad por todas las causas y causas específicas en una población general. Sci. Rep. 2019, 9, 16208. [CrossRef]

48. Whiteside, T.L. El microentorno tumoral y su papel en la promoción del crecimiento tumoral. Oncogene 2008, 27, 5904–5912. [CrossRef]

49. Chen, L.; Zhang, F.; Sheng, X.G.; Zhang, S.Q.; Chen, Y.T.; Liu, B.W. La relación entre plaquetas y linfocitos periféricos predice la metástasis a los ganglios linfáticos y actúa como un factor pronóstico superior para el cáncer cervical cuando se combina con la relación neutrófilos: linfocitos. Medicine 2016, 95, e4381. [CrossRef]

50. Huang, L.; Mo, Z.; Zhang, L.; Qin, S.; Qin, S.; Li, S. Valor diagnóstico de la relación albúmina: fibrinógeno en el cáncer cervical. Int. J. Biol. Markers 2020, 35, 66–73. [CrossRef]
## chunk 0043
hash: 51dfd0a97b1cf9a23af1f1359392c6c89c5c1f4b

**Original:**

96–101.

[CrossRef]

60. Gortzak-Uzan, L.; Jimenez, W.; Nofech-Mozes, S.; Ismiil, N.; Khalifa, M.A.; Dube, V.; Rosen, B.; Murphy, J.; Laframboise, S.;

Covens, A. Sentinel lymph node biopsy vs. pelvic lymphadenectomy in early stage cervical cancer: Is it time to change the gold

standard? Gynecol. Oncol. 2010, 116, 28–32. [CrossRef]

61. Chen, X.L.; Chen, G.W.; Xu, G.H.; Ren, J.; Li, Z.L.; Pu, H.; Li, H. Tumor Size at Magnetic Resonance Imaging Association With

Lymph Node Metastasis and Lymphovascular Space Invasion in Resectable Cervical Cancer: A Multicenter Evaluation of Surgical

Specimens. Int. J. Gynecol. Cancer 2018, 28, 1545–1552. [CrossRef]

**Traducción:**

96–101.

60. Gortzak-Uzan, L.; Jimenez, W.; Nofech-Mozes, S.; Ismiil, N.; Khalifa, M.A.; Dube, V.; Rosen, B.; Murphy, J.; Laframboise, S.; Covens, A. Biopsia de ganglio linfático centinela versus linfadenectomía pélvica en el cáncer de cuello uterino en etapa temprana: ¿es hora de cambiar el estándar de oro! Oncología Ginecológica 2010, 116, 28–32. 

61. Chen, X.L.; Chen, G.W.; Xu, G.H.; Ren, J.; Li, Z.L.; Pu, H.; Li, H. Tamaño del tumor en la resonancia magnética asociado con metástasis en ganglios linfáticos e invasión del espacio linfático en el cáncer de cuello uterino resecable: una evaluación multicéntrica de especímenes quirúrgicos. Cáncer Internacional de Ginecología 2018, 28, 1545–1552.
## chunk 0041
hash: 1a98cf2127f296b5e60551b4b0d5882364f6d866

**Original:**

g, L.; Qin, S.; Qin, S.; Li, S. Diagnostic Value of Albumin to Fibrinogen Ratio in Cervical Cancer. Int. J.

Biol. Markers 2020, 35, 66–73. [CrossRef]

51. Chen, X.; Duan, H.; Liu, P.; Lin, L.; Ni, Y.; Li, D.; Dai, E.; Zhan, X.; Li, P.; Huo, Z.; et al. Development and validation of a prognostic

nomogram for 2018 FIGO stages IB1, IB2, and IIA1 cervical cancer: A large multicenter study. Ann. Transl. Med. 2022, 10, 121.

[CrossRef]

52. Chu, R.; Zhang, Y.; Qiao, X.; Xie, L.; Chen, W.; Zhao, Y.; Xu, Y.; Yuan, Z.; Liu, X.; Yin, A.; et al. Risk Stratification of Early-Stage

Cervical Cancer with Intermediate-Risk Factors: Model Development and Validation Based on Machine Learning Algorithm.

Oncologist 2021, 26, e2217–e2226. [CrossRef] [PubMed]

53. Yang, H.S.; Li, B.; Liu, S.H.; Ao, M. Nomogram model for predicting postoperative survival of patients with stage IB-IIA cervical

cancer. Am. J. Cancer Res. 2021, 11, 5559–5570. [PubMed]

54. Du, W.; Wang, Y.; Li, D.; Xia, X.; Tan, Q.; Xiong, X.; Li, Z. Preoperative Prediction of Lymphovascular Space Invasion in Cervical

Cancer With Radiomics–Based Nomogram. Front. Oncol. 2021, 11, 637794. [CrossRef] [PubMed]

Curr. Oncol. 2022, 29 9629

55. Huang, G.; Cui, Y.; Wang, P.; Ren, J.; Wang, L.; Ma, Y.; Jia, Y.; Ma, X.; Zhao, L. Multi-Parametric Magnetic Resonance Imaging-

Based Radiomics Analysis of Cervical Cancer for Preoperative Prediction of Lymphovascular Space Invasion. Front. Oncol. 2021,

11, 663370. [CrossRef] [PubMed]

**Traducción:**

g, L.; Qin, S.; Qin, S.; Li, S. Valor diagnóstico de la relación albúmina a fibrinógeno en el cáncer cervical. Int. J. Biol. Markers 2020, 35, 66–73. [CrossRef]

51. Chen, X.; Duan, H.; Liu, P.; Lin, L.; Ni, Y.; Li, D.; Dai, E.; Zhan, X.; Li, P.; Huo, Z.; et al. Desarrollo y validación de un nomograma pronóstico para las etapas IB1, IB2 y IIA1 del cáncer cervical de 2018 FIGO: Un estudio multicéntrico grande. Ann. Transl. Med. 2022, 10, 121. [CrossRef]

52. Chu, R.; Zhang, Y.; Qiao, X.; Xie, L.; Chen, W.; Zhao, Y.; Xu, Y.; Yuan, Z.; Liu, X.; Yin, A.; et al. Estratificación del riesgo del cáncer cervical en estadio temprano con factores de riesgo intermedio: Desarrollo y validación del modelo basado en algoritmo de aprendizaje automático. Oncologist 2021, 26, e2217–e2226. [CrossRef] [PubMed]

53. Yang, H.S.; Li, B.; Liu, S.H.; Ao, M. Modelo de nomograma para predecir la supervivencia postoperatoria de pacientes con cáncer cervical en estadio IB-IIA. Am. J. Cancer Res. 2021, 11, 5559–5570. [PubMed]

54. Du, W.; Wang, Y.; Li, D.; Xia, X.; Tan, Q.; Xiong, X.; Li, Z. Predicción preoperatoria de la invasión del espacio linfovascular en el cáncer cervical con un nomograma basado en radiómica. Front. Oncol. 2021, 11, 637794. [CrossRef] [PubMed]

Curr. Oncol. 2022, 29 9629

55. Huang, G.; Cui, Y.; Wang, P.; Ren, J.; Wang, L.; Ma, Y.; Jia, Y.; Ma, X.; Zhao, L. Análisis de radiómica basado en imágenes de resonancia magnética multi-paramétrica del cáncer cervical para la predicción preoperatoria de la invasión del espacio linfovascular. Front. Oncol. 2021, 11, 663370. [CrossRef] [PubMed]
## chunk 0042
hash: fc3f9db5eec04b0db825ca576e7459825361d43b

**Original:**

diomics Analysis of Cervical Cancer for Preoperative Prediction of Lymphovascular Space Invasion. Front. Oncol. 2021,

11, 663370. [CrossRef] [PubMed]

56. Palsdottir, K.; Fischerova, D.; Franchi, D.; Testa, A.; Di Legge, A.; Epstein, E. Preoperative prediction of lymph node metastasis

and deep stromal invasion in women with invasive cervical cancer: Prospective multicenter study using 2D and 3D ultrasound.

Ultrasound Obstet. Gynecol. 2015, 45, 470–475. [CrossRef]

57. Okuno, K.; Joja, I.; Miyagi, Y.; Sakaguchi, Y.; Notohara, K.; Kudo, T.; Hiraki, Y. Cervical carcinoma with full-thickness stromal

invasion: Relationship between tumor size on T2-weighted images and parametrial involvement. J. Comput. Assist. Tomogr. 2002,

26, 119–125. [CrossRef]

58. Bidus, M.A.; Caffrey, A.S.; You, W.B.; Amezcua, C.A.; Chernofsky, M.R.; Barner, R.; Seidman, J.; Rose, G.S. Cervical biopsy and

excision procedure specimens lack sufficient predictive value for lymph-vascular space invasion seen at hysterectomy for cervical

cancer. Am. J. Obstet. Gynecol. 2008, 199, 151.e1–151.e4. [CrossRef]

59. Salvo, G.; Ramirez, P.T.; Levenback, C.F.; Munsell, M.F.; Euscher, E.D.; Soliman, P.T.; Frumovitz, M. Sensitivity and negative

predictive value for sentinel lymph node biopsy in women with early-stage cervical cancer. Gynecol. Oncol. 2017, 145, 96–101.

[CrossRef]

60. Gortzak-Uzan, L.; Jimenez, W.; Nofech-Mozes, S.; Ismiil, N.; Khalifa, M.A.; Dube, V.; Rosen, B.; Murphy, J.; Laframboise, S.;

**Traducción:**

Análisis de diomics del cáncer cervical para la predicción preoperatoria de la invasión del espacio linfovascular. Front. Oncol. 2021, 11, 663370. [CrossRef] [PubMed]

56. Palsdottir, K.; Fischerova, D.; Franchi, D.; Testa, A.; Di Legge, A.; Epstein, E. Predicción preoperatoria de metástasis en ganglios linfáticos y de invasión estromal profunda en mujeres con cáncer cervical invasivo: Estudio prospectivo multicéntrico utilizando ultrasonido 2D y 3D. Ultrasound Obstet. Gynecol. 2015, 45, 470–475. [CrossRef]

57. Okuno, K.; Joja, I.; Miyagi, Y.; Sakaguchi, Y.; Notohara, K.; Kudo, T.; Hiraki, Y. Carcinoma cervical con invasión estromal de grosor total: Relación entre el tamaño del tumor en imágenes ponderadas en T2 y la participación paramétrica. J. Comput. Assist. Tomogr. 2002, 26, 119–125. [CrossRef]

58. Bidus, M.A.; Caffrey, A.S.; You, W.B.; Amezcua, C.A.; Chernofsky, M.R.; Barner, R.; Seidman, J.; Rose, G.S. Las muestras de biopsia y procedimientos de excisión cervical carecen de valor predictivo suficiente para la invasión del espacio linfovascular observada en la histerectomía por cáncer cervical. Am. J. Obstet. Gynecol. 2008, 199, 151.e1–151.e4. [CrossRef]

59. Salvo, G.; Ramirez, P.T.; Levenback, C.F.; Munsell, M.F.; Euscher, E.D.; Soliman, P.T.; Frumovitz, M. Sensibilidad y valor predictivo negativo para la biopsia del ganglio linfático centinela en mujeres con cáncer cervical en estadio temprano. Gynecol. Oncol. 2017, 145, 96–101. [CrossRef]

60. Gortzak-Uzan, L.; Jimenez, W.; Nofech-Mozes, S.; Ismiil, N.; Khalifa, M.A.; Dube, V.; Rosen, B.; Murphy, J.; Laframboise, S;
