import React, { useState, useEffect } from 'react';
import { Users, Plus, Edit2, Trash2, Save, X, Search, FileDown, FileUp, Heart, Baby, ChevronDown, ChevronRight } from 'lucide-react';

const App = () => {
  const [people, setPeople] = useState([]);
  const [families, setFamilies] = useState([]);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('list');
  const [dbReady, setDbReady] = useState(false);
  const [showFamilyModal, setShowFamilyModal] = useState(false);
  const [currentFamily, setCurrentFamily] = useState(null);
  const [rootPersonId, setRootPersonId] = useState(null);

  // IndexedDB ініціалізація
  const initDB = () => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('FamilyTreeDB', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('people')) {
          db.createObjectStore('people', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('families')) {
          db.createObjectStore('families', { keyPath: 'id' });
        }
      };
    });
  };

  const savePeopleToDB = async (peopleData) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(['people'], 'readwrite');
      const store = transaction.objectStore('people');
      await store.clear();
      for (const person of peopleData) {
        await store.put(person);
      }
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Помилка збереження людей:', error);
    }
  };

  const saveFamiliesToDB = async (familiesData) => {
    try {
      const db = await initDB();
      const transaction = db.transaction(['families'], 'readwrite');
      const store = transaction.objectStore('families');
      await store.clear();
      for (const family of familiesData) {
        await store.put(family);
      }
      return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      });
    } catch (error) {
      console.error('Помилка збереження сімей:', error);
    }
  };

  const loadPeopleFromDB = async () => {
    try {
      const db = await initDB();
      const transaction = db.transaction(['people'], 'readonly');
      const store = transaction.objectStore('people');
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Помилка завантаження людей:', error);
      return [];
    }
  };

  const loadFamiliesFromDB = async () => {
    try {
      const db = await initDB();
      const transaction = db.transaction(['families'], 'readonly');
      const store = transaction.objectStore('families');
      const request = store.getAll();
      return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('Помилка завантаження сімей:', error);
      return [];
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        await initDB();
        const loadedPeople = await loadPeopleFromDB();
        const loadedFamilies = await loadFamiliesFromDB();
        if (loadedPeople.length > 0) setPeople(loadedPeople);
        if (loadedFamilies.length > 0) setFamilies(loadedFamilies);
        setDbReady(true);
      } catch (error) {
        console.error('Помилка ініціалізації:', error);
        setDbReady(true);
      }
    };
    loadData();
  }, []);

  const saveData = async (newPeople, newFamilies) => {
    await savePeopleToDB(newPeople || people);
    await saveFamiliesToDB(newFamilies || families);
  };

  const parseGEDCOM = (gedcomText) => {
    const lines = gedcomText.split('\n');
    const newPeople = [];
    const newFamilies = [];
    let currentPerson = null;
    let currentFamily = null;
    let currentContext = null;

    lines.forEach(line => {
      const parts = line.trim().split(' ');
      const level = parseInt(parts[0]);
      const tag = parts[1];
      const value = parts.slice(2).join(' ');

      if (level === 0 && tag.startsWith('@') && parts[2] === 'INDI') {
        if (currentPerson) newPeople.push(currentPerson);
        currentPerson = { id: tag, name: '', sex: '', birth: '', residence: '', occupation: '', families: [], parents: [] };
        currentContext = 'person';
      } else if (level === 0 && tag.startsWith('@') && parts[2] === 'FAM') {
        if (currentFamily) newFamilies.push(currentFamily);
        currentFamily = { id: tag, husband: '', wife: '', children: [] };
        currentContext = 'family';
      } else if (currentContext === 'person' && currentPerson) {
        if (level === 1 && tag === 'NAME') {
          currentPerson.name = value.replace(/\//g, '');
        } else if (level === 1 && tag === 'SEX') {
          currentPerson.sex = value;
        } else if (level === 1 && tag === 'BIRT') {
          currentPerson.birthContext = true;
        } else if (level === 2 && tag === 'DATE' && currentPerson.birthContext) {
          currentPerson.birth = value;
          currentPerson.birthContext = false;
        } else if (level === 1 && tag === 'FAMS') {
          currentPerson.families.push(value);
        } else if (level === 1 && tag === 'FAMC') {
          currentPerson.parents.push(value);
        } else if (level === 1 && tag === 'RESI') {
          currentPerson.resiContext = true;
        } else if (level === 2 && tag === 'PLAC' && currentPerson.resiContext) {
          currentPerson.residence = value;
          currentPerson.resiContext = false;
        } else if (level === 1 && tag === 'OCCU') {
          currentPerson.occupation = value;
        }
      } else if (currentContext === 'family' && currentFamily) {
        if (level === 1 && tag === 'HUSB') {
          currentFamily.husband = value;
        } else if (level === 1 && tag === 'WIFE') {
          currentFamily.wife = value;
        } else if (level === 1 && tag === 'CHIL') {
          currentFamily.children.push(value);
        }
      }
    });

    if (currentPerson) newPeople.push(currentPerson);
    if (currentFamily) newFamilies.push(currentFamily);

    setPeople(newPeople);
    setFamilies(newFamilies);
    saveData(newPeople, newFamilies);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        parseGEDCOM(event.target.result);
      };
      reader.readAsText(file);
    }
  };

  const exportGEDCOM = () => {
    let gedcom = '0 HEAD\n1 SOUR FamilyTreeApp\n1 GEDC\n2 VERS 5.5\n';
    
    people.forEach(person => {
      gedcom += `0 ${person.id} INDI\n`;
      gedcom += `1 NAME ${person.name}\n`;
      gedcom += `1 SEX ${person.sex}\n`;
      if (person.birth) gedcom += `1 BIRT\n2 DATE ${person.birth}\n`;
      if (person.residence) gedcom += `1 RESI\n2 PLAC ${person.residence}\n`;
      if (person.occupation) gedcom += `1 OCCU ${person.occupation}\n`;
      person.families.forEach(fam => gedcom += `1 FAMS ${fam}\n`);
      person.parents.forEach(fam => gedcom += `1 FAMC ${fam}\n`);
    });

    families.forEach(family => {
      gedcom += `0 ${family.id} FAM\n`;
      if (family.husband) gedcom += `1 HUSB ${family.husband}\n`;
      if (family.wife) gedcom += `1 WIFE ${family.wife}\n`;
      family.children.forEach(child => gedcom += `1 CHIL ${child}\n`);
    });

    gedcom += '0 TRLR\n';

    const blob = new Blob([gedcom], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family_tree.ged';
    a.click();
  };

  const addPerson = () => {
    const newId = `@I${people.length + 1}@`;
    const newPerson = {
      id: newId,
      name: '',
      sex: 'M',
      birth: '',
      residence: '',
      occupation: '',
      families: [],
      parents: []
    };
    const updated = [...people, newPerson];
    setPeople(updated);
    setSelectedPerson(newPerson);
    setIsEditing(true);
    setView('edit');
    saveData(updated, families);
  };

  const updatePerson = (updatedPerson) => {
    const updated = people.map(p => p.id === updatedPerson.id ? updatedPerson : p);
    setPeople(updated);
    setSelectedPerson(updatedPerson);
    saveData(updated, families);
  };

  const deletePerson = (id) => {
    if (confirm('Видалити цю особу?')) {
      const updated = people.filter(p => p.id !== id);
      setPeople(updated);
      setSelectedPerson(null);
      saveData(updated, families);
    }
  };

  const clearDatabase = async () => {
    if (confirm('⚠️ УВАГА! Це видалить ВСІ дані з бази. Продовжити?')) {
      if (confirm('Ви впевнені? Цю дію не можна скасувати!')) {
        try {
          setPeople([]);
          setFamilies([]);
          setSelectedPerson(null);
          await new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase('FamilyTreeDB');
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
            request.onblocked = () => {
              console.warn('База даних заблокована');
              resolve();
            };
          });
          alert('✅ База даних успішно очищена!');
          window.location.reload();
        } catch (error) {
          console.error('Помилка очищення бази:', error);
          alert('❌ Помилка при очищенні бази даних');
        }
      }
    }
  };

  const getPersonById = (id) => people.find(p => p.id === id);

  const getSpouse = (personId) => {
    const person = getPersonById(personId);
    if (!person) return null;
    
    for (const famId of person.families) {
      const family = families.find(f => f.id === famId);
      if (family) {
        if (family.husband === personId && family.wife) {
          return getPersonById(family.wife);
        }
        if (family.wife === personId && family.husband) {
          return getPersonById(family.husband);
        }
      }
    }
    return null;
  };

  const getChildren = (personId) => {
    const person = getPersonById(personId);
    if (!person) return [];
    
    const children = [];
    person.families.forEach(famId => {
      const family = families.find(f => f.id === famId);
      if (family) {
        family.children.forEach(childId => {
          const child = getPersonById(childId);
          if (child) children.push(child);
        });
      }
    });
    return children;
  };

  const getParents = (personId) => {
    const person = getPersonById(personId);
    if (!person || !person.parents || person.parents.length === 0) return [];
    
    const parents = [];
    person.parents.forEach(famId => {
      const family = families.find(f => f.id === famId);
      if (family) {
        // Завжди додаємо обох батьків, якщо вони є
        if (family.husband) {
          const father = getPersonById(family.husband);
          if (father) parents.push(father);
        }
        if (family.wife) {
          const mother = getPersonById(family.wife);
          if (mother) parents.push(mother);
        }
      }
    });
    return parents;
  };

  const createFamily = () => {
    const newFamId = `@F${families.length + 1}@`;
    setCurrentFamily({
      id: newFamId,
      husband: '',
      wife: '',
      children: []
    });
    setShowFamilyModal(true);
  };

  const saveFamilyRelation = () => {
    if (!currentFamily.husband && !currentFamily.wife) {
      alert('Оберіть хоча б одного з подружжя');
      return;
    }

    const updatedFamilies = [...families];
    const existingIndex = updatedFamilies.findIndex(f => f.id === currentFamily.id);
    
    if (existingIndex >= 0) {
      updatedFamilies[existingIndex] = currentFamily;
    } else {
      updatedFamilies.push(currentFamily);
    }

    // Оновлюємо людей з посиланнями на сім'ї
    const updatedPeople = people.map(person => {
      if (person.id === currentFamily.husband || person.id === currentFamily.wife) {
        if (!person.families.includes(currentFamily.id)) {
          return { ...person, families: [...person.families, currentFamily.id] };
        }
      }
      if (currentFamily.children.includes(person.id)) {
        if (!person.parents.includes(currentFamily.id)) {
          return { ...person, parents: [...person.parents, currentFamily.id] };
        }
      }
      return person;
    });

    setPeople(updatedPeople);
    setFamilies(updatedFamilies);
    saveData(updatedPeople, updatedFamilies);
    setShowFamilyModal(false);
    setCurrentFamily(null);
  };

  const filteredPeople = people.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.occupation?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const PersonCard = ({ person, showRelations = false }) => {
    const spouse = getSpouse(person.id);
    const children = getChildren(person.id);
    const parents = getParents(person.id);
    const [expanded, setExpanded] = useState(true);

    return (
      <div className="border-2 border-gray-300 rounded-lg p-3 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <div 
            className="flex items-center gap-2 cursor-pointer flex-1"
            onClick={() => {
              setSelectedPerson(person);
              setView('edit');
            }}
          >
            <Users size={20} className={person.sex === 'M' ? 'text-blue-500' : 'text-pink-500'} />
            <div>
              <h3 className="font-bold">{person.name || 'Без імені'}</h3>
              {person.birth && <p className="text-xs text-gray-500">{person.birth}</p>}
            </div>
          </div>
          {showRelations && (children.length > 0 || spouse) && (
            <button onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
            </button>
          )}
        </div>

        {showRelations && expanded && (
          <>
            {spouse && (
              <div className="ml-4 mb-2 flex items-center gap-2 text-sm">
                <Heart size={16} className="text-red-500" />
                <span className="text-gray-700">
                  Подружжя: <strong>{spouse.name}</strong>
                </span>
              </div>
            )}

            {children.length > 0 && (
              <div className="ml-4 border-l-2 border-blue-300 pl-3 mt-2">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Baby size={16} />
                  <span>Діти:</span>
                </div>
                {children.map(child => (
                  <PersonCard key={child.id} person={child} showRelations={true} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // Функція для побудови дерева предків у вигляді структури даних
  const buildAncestorLevels = (personId, level = 1, levels = {}) => {
    const person = getPersonById(personId);
    if (!person) return levels;
    
    if (!levels[level]) levels[level] = [];
    levels[level].push(person);
    
    const parents = getParents(personId);
    parents.forEach(parent => {
      buildAncestorLevels(parent.id, level + 1, levels);
    });
    
    return levels;
  };

  const AncestorTreeGrid = ({ person }) => {
    if (!person) return null;
    
    const spouse = getSpouse(person.id);
    const personParents = getParents(person.id);
    const spouseParents = spouse ? getParents(spouse.id) : [];
    
    // Будуємо рівні для обох гілок (рівень 2 і вище)
    const personLevels = personParents.length > 0 
      ? personParents.reduce((acc, parent) => {
          const levels = buildAncestorLevels(parent.id, 2); // Починаємо з рівня 2
          Object.keys(levels).forEach(level => {
            if (!acc[level]) acc[level] = [];
            acc[level].push(...levels[level]);
          });
          return acc;
        }, {})
      : {};
    
    const spouseLevels = spouse && spouseParents.length > 0
      ? spouseParents.reduce((acc, parent) => {
          const levels = buildAncestorLevels(parent.id, 2); // Починаємо з рівня 2
          Object.keys(levels).forEach(level => {
            if (!acc[level]) acc[level] = [];
            acc[level].push(...levels[level]);
          });
          return acc;
        }, {})
      : {};
    
    const maxLevel = Math.max(
      ...Object.keys(personLevels).map(Number),
      ...Object.keys(spouseLevels).map(Number),
      1
    );
    
    console.log('\n=== AncestorTree Grid ===');
    console.log('Максимальний рівень:', maxLevel);
    console.log('Рівні головної особи:', personLevels);
    console.log('Рівні подружжя:', spouseLevels);

    const renderPersonCard = (p) => (
      <div 
        key={p.id}
        className={`border-2 rounded-lg p-2 bg-white shadow-sm hover:shadow-md transition-all cursor-pointer relative
          ${p.sex === 'M' ? 'border-l-4 border-l-blue-400' : 'border-l-4 border-l-pink-400'} border-gray-300`}
        style={{ 
          width: '130px',
          height: '70px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
        onClick={() => {
          setSelectedPerson(p);
          setView('edit');
        }}
        title={`${p.name}\nСтать: ${p.sex === 'M' ? 'Ч' : 'Ж'}`}
      >
        <div className="flex items-center gap-1 w-full px-1">
          <Users size={13} className={p.sex === 'M' ? 'text-blue-600' : 'text-pink-600'} />
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-xs truncate leading-tight">{p.name || 'Без імені'}</h3>
            {p.birth && <p className="text-xs text-gray-500 leading-tight mt-0.5">{p.birth}</p>}
          </div>
        </div>
      </div>
    );

    return (
      <div className="flex flex-col items-center py-6 px-4">
        {/* Рівні предків (рівень 2 і вище) */}
        {maxLevel >= 2 && (
          <div className="mb-6">
            {Array.from({ length: maxLevel - 1 }, (_, i) => maxLevel - i).map(level => (
              <div key={level} className="mb-8">
                <div className="text-xs text-gray-500 text-center mb-3 font-semibold">
                  Покоління {level} ({level === 2 ? 'Діди/Баби' : level === 3 ? 'Прадіди/Прабаби' : `Предки рівня ${level}`})
                </div>
                
                <div className="flex gap-32 justify-center items-start">
                  {/* Гілка головної особи */}
                  <div className="flex flex-col items-center">
                    <div className="flex gap-4 justify-center">
                      {personLevels[level] ? (
                        personLevels[level].map(p => renderPersonCard(p))
                      ) : (
                        <div className="text-xs text-gray-400 italic" style={{ width: '130px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          —
                        </div>
                      )}
                    </div>
                    
                    {/* Лінії вниз */}
                    {personLevels[level] && (
                      <div className="flex justify-center mt-2">
                        {personLevels[level].length === 2 ? (
                          <div className="flex flex-col items-center">
                            <div className="flex">
                              <div className="h-0.5 bg-blue-400" style={{width: '65px'}}></div>
                              <div className="h-0.5 bg-pink-400" style={{width: '65px'}}></div>
                            </div>
                            <div className="w-0.5 h-8 bg-gray-500"></div>
                          </div>
                        ) : (
                          <div className="w-0.5 h-8 bg-gray-500"></div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Гілка подружжя */}
                  {spouse && (
                    <div className="flex flex-col items-center">
                      <div className="flex gap-4 justify-center">
                        {spouseLevels[level] ? (
                          spouseLevels[level].map(p => renderPersonCard(p))
                        ) : (
                          <div className="text-xs text-gray-400 italic" style={{ width: '130px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            —
                          </div>
                        )}
                      </div>
                      
                      {/* Лінії вниз */}
                      {spouseLevels[level] && (
                        <div className="flex justify-center mt-2">
                          {spouseLevels[level].length === 2 ? (
                            <div className="flex flex-col items-center">
                              <div className="flex">
                                <div className="h-0.5 bg-blue-400" style={{width: '65px'}}></div>
                                <div className="h-0.5 bg-pink-400" style={{width: '65px'}}></div>
                              </div>
                              <div className="w-0.5 h-8 bg-gray-500"></div>
                            </div>
                          ) : (
                            <div className="w-0.5 h-8 bg-gray-500"></div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Рівень 1 - Батьки (показуємо ОДИН РАЗ) */}
        {(personParents.length > 0 || (spouse && spouseParents.length > 0)) && (
          <div className="mb-8">
            <div className="text-xs text-gray-500 text-center mb-3 font-semibold">
              Покоління 1 (Батьки)
            </div>
            
            <div className="flex gap-32 justify-center items-start">
              {/* Батьки головної особи */}
              <div className="flex flex-col items-center">
                <div className="flex gap-4">
                  {personParents.length > 0 ? (
                    personParents.map(p => renderPersonCard(p))
                  ) : (
                    <div className="text-xs text-gray-400 italic border border-dashed border-gray-300 rounded p-3" style={{ width: '130px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      Немає даних
                    </div>
                  )}
                </div>
                
                {/* Лінії вниз до дитини */}
                {personParents.length > 0 && (
                  <div className="flex flex-col items-center mt-2">
                    {personParents.length === 2 && (
                      <div className="flex">
                        <div className="h-0.5 bg-blue-400" style={{width: '65px'}}></div>
                        <div className="h-0.5 bg-pink-400" style={{width: '65px'}}></div>
                      </div>
                    )}
                    <div className="w-0.5 h-8 bg-gray-500"></div>
                  </div>
                )}
              </div>
              
              {/* Батьки подружжя */}
              {spouse && (
                <div className="flex flex-col items-center">
                  <div className="flex gap-4">
                    {spouseParents.length > 0 ? (
                      spouseParents.map(p => renderPersonCard(p))
                    ) : (
                      <div className="text-xs text-gray-400 italic border border-dashed border-gray-300 rounded p-3" style={{ width: '130px', height: '70px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        Немає даних
                      </div>
                    )}
                  </div>
                  
                  {/* Лінії вниз до дитини */}
                  {spouseParents.length > 0 && (
                    <div className="flex flex-col items-center mt-2">
                      {spouseParents.length === 2 && (
                        <div className="flex">
                          <div className="h-0.5 bg-blue-400" style={{width: '65px'}}></div>
                          <div className="h-0.5 bg-pink-400" style={{width: '65px'}}></div>
                        </div>
                      )}
                      <div className="w-0.5 h-8 bg-gray-500"></div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Рівень 0 - Пара */}
        <div className="flex items-center gap-4 px-6 py-3 bg-gradient-to-r from-blue-50 via-white to-pink-50 rounded-lg shadow-md">
          {spouse && person.sex === 'F' && (
            <>
              <div 
                className="border-2 border-blue-500 rounded-lg p-3 bg-blue-50 shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center"
                style={{ width: '170px', height: '85px' }}
                onClick={() => setRootPersonId(spouse.id)}
                title="Клікніть для перегляду дерева"
              >
                <div className="flex items-center gap-2 w-full">
                  <Users size={20} className="text-blue-700 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{spouse.name}</h3>
                    {spouse.birth && <p className="text-xs text-gray-600 mt-0.5">{spouse.birth}</p>}
                    <p className="text-xs text-blue-700 font-semibold mt-1">♂ Чоловік</p>
                  </div>
                </div>
              </div>
              <Heart size={24} className="text-red-500 flex-shrink-0" />
            </>
          )}

          <div 
            className={`border-3 rounded-lg p-3 shadow-xl hover:shadow-2xl transition-all cursor-pointer flex items-center ${
              person.sex === 'M' ? 'border-blue-600 bg-gradient-to-br from-blue-100 to-blue-50' : 'border-pink-600 bg-gradient-to-br from-pink-100 to-pink-50'
            }`}
            style={{ borderWidth: '3px', width: '170px', height: '85px' }}
            onClick={() => {
              setSelectedPerson(person);
              setView('edit');
            }}
          >
            <div className="flex items-center gap-2 w-full">
              <Users size={20} className={person.sex === 'M' ? 'text-blue-700' : 'text-pink-700'} />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm truncate">{person.name}</h3>
                {person.birth && <p className="text-xs text-gray-600 mt-0.5">{person.birth}</p>}
                <p className="text-xs font-bold uppercase mt-1" style={{color: person.sex === 'M' ? '#1d4ed8' : '#be185d'}}>
                  ★ ВИБРАНО
                </p>
              </div>
            </div>
          </div>

          {spouse && person.sex === 'M' && (
            <>
              <Heart size={24} className="text-red-500 flex-shrink-0" />
              <div 
                className="border-2 border-pink-500 rounded-lg p-3 bg-pink-50 shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center"
                style={{ width: '170px', height: '85px' }}
                onClick={() => setRootPersonId(spouse.id)}
                title="Клікніть для перегляду дерева"
              >
                <div className="flex items-center gap-2 w-full">
                  <Users size={20} className="text-pink-700 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm truncate">{spouse.name}</h3>
                    {spouse.birth && <p className="text-xs text-gray-600 mt-0.5">{spouse.birth}</p>}
                    <p className="text-xs text-pink-700 font-semibold mt-1">♀ Дружина</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-2xl font-bold text-gray-700">Завантаження...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <Users className="text-indigo-600" size={36} />
                Генеалогічне Дерево
              </h1>
              <p className="text-sm text-green-600 mt-1">✓ Працює офлайн (IndexedDB)</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <label className="cursor-pointer bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2">
                <FileUp size={20} />
                Завантажити
                <input type="file" accept=".ged" onChange={handleFileUpload} className="hidden" />
              </label>
              <button 
                onClick={exportGEDCOM}
                className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <FileDown size={20} />
                Експорт
              </button>
              <button 
                onClick={clearDatabase}
                className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 flex items-center gap-2"
              >
                <Trash2 size={20} />
                Очистити
              </button>
            </div>
          </div>

          <div className="flex gap-2 mb-4 flex-wrap">
            <button
              onClick={() => setView('list')}
              className={`px-4 py-2 rounded-lg ${view === 'list' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
            >
              Список
            </button>
            <button
              onClick={() => setView('tree')}
              className={`px-4 py-2 rounded-lg ${view === 'tree' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
            >
              Дерево нащадків
            </button>
            <button
              onClick={() => setView('ancestors')}
              className={`px-4 py-2 rounded-lg ${view === 'ancestors' ? 'bg-indigo-600 text-white' : 'bg-gray-200'}`}
            >
              Дерево предків
            </button>
            <button
              onClick={addPerson}
              className="ml-auto bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center gap-2"
            >
              <Plus size={20} />
              Додати особу
            </button>
            <button
              onClick={createFamily}
              className="bg-pink-600 text-white px-4 py-2 rounded-lg hover:bg-pink-700 flex items-center gap-2"
            >
              <Heart size={20} />
              Створити сім'ю
            </button>
          </div>

          {view === 'list' && (
            <div>
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                  <input
                    type="text"
                    placeholder="Пошук за ім'ям або професією..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredPeople.map(person => (
                  <div key={person.id} className="border rounded-lg p-4 hover:shadow-lg transition-shadow bg-white">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Users size={20} className={person.sex === 'M' ? 'text-blue-500' : 'text-pink-500'} />
                          <h3 className="font-bold text-lg">{person.name || 'Без імені'}</h3>
                        </div>
                        {person.birth && <p className="text-sm text-gray-600">📅 {person.birth}</p>}
                        {person.residence && <p className="text-sm text-gray-600">📍 {person.residence}</p>}
                        {person.occupation && <p className="text-sm text-gray-600">💼 {person.occupation}</p>}
                        
                        {getSpouse(person.id) && (
                          <p className="text-sm text-pink-600 flex items-center gap-1 mt-2">
                            <Heart size={14} /> {getSpouse(person.id).name}
                          </p>
                        )}
                        
                        {getChildren(person.id).length > 0 && (
                          <p className="text-sm text-blue-600 flex items-center gap-1">
                            <Baby size={14} /> {getChildren(person.id).length} дітей
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => {
                            setRootPersonId(person.id);
                            setView('tree');
                          }}
                          className="text-green-500 hover:bg-green-50 p-2 rounded"
                          title="Показати дерево нащадків"
                        >
                          <Users size={18} />
                        </button>
                        <button
                          onClick={() => {
                            setRootPersonId(person.id);
                            setView('ancestors');
                          }}
                          className="text-purple-500 hover:bg-purple-50 p-2 rounded"
                          title="Показати дерево предків"
                        >
                          <Users size={18} className="rotate-180" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedPerson(person);
                            setView('edit');
                            setIsEditing(true);
                          }}
                          className="text-blue-500 hover:bg-blue-50 p-2 rounded"
                        >
                          <Edit2 size={18} />
                        </button>
                        <button
                          onClick={() => deletePerson(person.id)}
                          className="text-red-500 hover:bg-red-50 p-2 rounded"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {view === 'tree' && (
            <div className="bg-gray-50 p-4 rounded-lg overflow-x-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Дерево нащадків</h2>
                {rootPersonId && (
                  <button
                    onClick={() => setRootPersonId(null)}
                    className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                  >
                    Показати все дерево
                  </button>
                )}
              </div>
              
              {rootPersonId ? (
                <PersonCard person={getPersonById(rootPersonId)} showRelations={true} />
              ) : (
                people.filter(p => !p.parents.length).map(rootPerson => (
                  <div key={rootPerson.id} className="mb-4">
                    <PersonCard person={rootPerson} showRelations={true} />
                  </div>
                ))
              )}
            </div>
          )}

          {view === 'ancestors' && (
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Дерево предків</h2>
                {rootPersonId ? (
                  <button
                    onClick={() => setRootPersonId(null)}
                    className="text-sm bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
                  >
                    Скасувати вибір
                  </button>
                ) : (
                  <p className="text-sm text-gray-600">Оберіть особу зі списку</p>
                )}
              </div>
              
              {rootPersonId ? (
                <div className="overflow-x-auto pb-4">
                  <div className="inline-block min-w-full">
                    <AncestorTreeGrid person={getPersonById(rootPersonId)} />
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users size={48} className="mx-auto text-gray-400 mb-4" />
                  <p className="text-gray-600 mb-4">Оберіть особу для відображення дерева предків</p>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 max-w-5xl mx-auto">
                    {people.map(person => (
                      <button
                        key={person.id}
                        onClick={() => setRootPersonId(person.id)}
                        className="border-2 border-gray-300 rounded-lg p-3 hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Users size={16} className={person.sex === 'M' ? 'text-blue-500' : 'text-pink-500'} />
                          <h3 className="font-bold text-sm truncate">{person.name || 'Без імені'}</h3>
                        </div>
                        {person.birth && <p className="text-xs text-gray-500">{person.birth}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'edit' && selectedPerson && (
            <div className="bg-white border rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold">
                  {isEditing ? 'Редагування' : 'Перегляд'}
                </h2>
                <button
                  onClick={() => setView('list')}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block font-medium mb-1">Ім'я</label>
                  <input
                    type="text"
                    value={selectedPerson.name}
                    onChange={(e) => setSelectedPerson({...selectedPerson, name: e.target.value})}
                    disabled={!isEditing}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">Стать</label>
                  <select
                    value={selectedPerson.sex}
                    onChange={(e) => setSelectedPerson({...selectedPerson, sex: e.target.value})}
                    disabled={!isEditing}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="M">Чоловіча</option>
                    <option value="F">Жіноча</option>
                  </select>
                </div>

                <div>
                  <label className="block font-medium mb-1">Дата народження</label>
                  <input
                    type="text"
                    value={selectedPerson.birth}
                    onChange={(e) => setSelectedPerson({...selectedPerson, birth: e.target.value})}
                    disabled={!isEditing}
                    className="w-full border rounded-lg px-3 py-2"
                    placeholder="DD MMM YYYY"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">Місце проживання</label>
                  <input
                    type="text"
                    value={selectedPerson.residence}
                    onChange={(e) => setSelectedPerson({...selectedPerson, residence: e.target.value})}
                    disabled={!isEditing}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1">Професія</label>
                  <input
                    type="text"
                    value={selectedPerson.occupation}
                    onChange={(e) => setSelectedPerson({...selectedPerson, occupation: e.target.value})}
                    disabled={!isEditing}
                    className="w-full border rounded-lg px-3 py-2"
                  />
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-bold mb-2">Родинні зв'язки</h3>
                  {getSpouse(selectedPerson.id) && (
                    <p className="text-sm flex items-center gap-2 mb-1">
                      <Heart size={16} className="text-red-500" />
                      Подружжя: <strong>{getSpouse(selectedPerson.id).name}</strong>
                    </p>
                  )}
                  {getParents(selectedPerson.id).length > 0 && (
                    <p className="text-sm mb-1">
                      Батьки: <strong>{getParents(selectedPerson.id).map(p => p.name).join(', ')}</strong>
                    </p>
                  )}
                  {getChildren(selectedPerson.id).length > 0 && (
                    <p className="text-sm flex items-center gap-2">
                      <Baby size={16} className="text-blue-500" />
                      Діти: <strong>{getChildren(selectedPerson.id).map(c => c.name).join(', ')}</strong>
                    </p>
                  )}
                </div>

                <div className="flex gap-2">
                  {isEditing ? (
                    <>
                      <button
                        onClick={() => {
                          updatePerson(selectedPerson);
                          setIsEditing(false);
                        }}
                        className="bg-green-500 text-white px-4 py-2 rounded-lg hover:bg-green-600 flex items-center gap-2"
                      >
                        <Save size={20} />
                        Зберегти
                      </button>
                      <button
                        onClick={async () => {
                          setIsEditing(false);
                          const loadedPeople = await loadPeopleFromDB();
                          setPeople(loadedPeople);
                        }}
                        className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                      >
                        Скасувати
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 flex items-center gap-2"
                    >
                      <Edit2 size={20} />
                      Редагувати
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Модальне вікно для створення сім'ї */}
      {showFamilyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Heart className="text-pink-500" size={28} />
                Створити сім'ю
              </h2>
              <button
                onClick={() => {
                  setShowFamilyModal(false);
                  setCurrentFamily(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-medium mb-2">Чоловік</label>
                <select
                  value={currentFamily?.husband || ''}
                  onChange={(e) => setCurrentFamily({...currentFamily, husband: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">-- Оберіть --</option>
                  {people.filter(p => p.sex === 'M').map(person => (
                    <option key={person.id} value={person.id}>
                      {person.name || 'Без імені'} ({person.birth})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium mb-2">Дружина</label>
                <select
                  value={currentFamily?.wife || ''}
                  onChange={(e) => setCurrentFamily({...currentFamily, wife: e.target.value})}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">-- Оберіть --</option>
                  {people.filter(p => p.sex === 'F').map(person => (
                    <option key={person.id} value={person.id}>
                      {person.name || 'Без імені'} ({person.birth})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-medium mb-2">Діти</label>
                <div className="border rounded-lg p-3 max-h-48 overflow-y-auto space-y-2">
                  {people.map(person => (
                    <label key={person.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                      <input
                        type="checkbox"
                        checked={currentFamily?.children.includes(person.id) || false}
                        onChange={(e) => {
                          const newChildren = e.target.checked
                            ? [...currentFamily.children, person.id]
                            : currentFamily.children.filter(id => id !== person.id);
                          setCurrentFamily({...currentFamily, children: newChildren});
                        }}
                        className="w-4 h-4"
                      />
                      <Users size={16} className={person.sex === 'M' ? 'text-blue-500' : 'text-pink-500'} />
                      <span className="text-sm">
                        {person.name || 'Без імені'} {person.birth && `(${person.birth})`}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t">
                <button
                  onClick={saveFamilyRelation}
                  className="flex-1 bg-pink-500 text-white px-4 py-2 rounded-lg hover:bg-pink-600 flex items-center justify-center gap-2"
                >
                  <Save size={20} />
                  Зберегти сім'ю
                </button>
                <button
                  onClick={() => {
                    setShowFamilyModal(false);
                    setCurrentFamily(null);
                  }}
                  className="flex-1 bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                >
                  Скасувати
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;